import 'dotenv/config'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '../src/db'
import { cartItems, carts, orders, payments, productVariants, users } from '../src/db/schema'
import { notifyOrderPlaced, placeOrder } from '../src/modules/checkout/service'
import * as paymentService from '../src/modules/payments/service'

const host = (() => {
  try {
    return new URL(process.env.APP_URL ?? 'http://localhost').hostname
  } catch {
    return ''
  }
})()

if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`Refusing to run: APP_URL points at ${host || 'an unknown host'}, not localhost.`)
  process.exit(1)
}

const reset = process.argv.includes('--reset')

const SHIPPING = [
  {
    fullName: 'مریم رضایی',
    phone: '09121234567',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'خیابان ولیعصر، بالاتر از پارک ساعی، کوچه شهید احمدی، پلاک ۲۴، واحد ۷',
    postalCode: '1434895111',
    customerNote: 'لطفاً بسته‌بندی بدون نام فروشگاه باشد.',
  },
  {
    fullName: 'سارا موسوی',
    phone: '09123334455',
    province: 'اصفهان',
    city: 'اصفهان',
    addressLine: 'خیابان چهارباغ بالا، نبش کوچه ۱۲، ساختمان نگین، طبقه ۳',
    postalCode: '8173954321',
    customerNote: '',
  },
  {
    fullName: 'نگین کاظمی',
    phone: '09127778899',
    province: 'فارس',
    city: 'شیراز',
    addressLine: 'بلوار زند، روبه‌روی داروخانه مرکزی، پلاک ۸۹',
    postalCode: '7143984567',
    customerNote: 'تحویل بعدازظهر.',
  },
  {
    fullName: 'الهام صادقی',
    phone: '09355556677',
    province: 'خراسان رضوی',
    city: 'مشهد',
    addressLine: 'بلوار وکیل‌آباد، بین وکیل‌آباد ۱۴ و ۱۶، پلاک ۳۱۲',
    postalCode: '9177845612',
    customerNote: '',
  },
  {
    fullName: 'زهرا امینی',
    phone: '09189990011',
    province: 'آذربایجان شرقی',
    city: 'تبریز',
    addressLine: 'خیابان امام خمینی، جنب بانک ملی، پلاک ۵۶، واحد ۲',
    postalCode: '5137733445',
    customerNote: 'اگر سایز ۷۵B موجود نبود تماس بگیرید.',
  },
]

async function main() {
  console.log('\nOrchid — demo orders through the real checkout service\n')

  const [customer] = await db
    .select({ id: users.id, phone: users.phone, fullName: users.fullName })
    .from(users)
    .where(sql`${users.phoneVerifiedAt} IS NOT NULL`)
    .limit(1)

  if (!customer) {
    console.error('No verified customer exists. Run:')
    console.error("  npm run dev:account -- customer 09121234567 'a-password'")
    process.exit(1)
  }

  if (reset) {
    const existing = await db.select({ id: orders.id }).from(orders).where(eq(orders.userId, customer.id))
    if (existing.length > 0) {
      const ids = existing.map((o) => o.id)
      const list = sql.join(ids.map((i) => sql`${i}`), sql`, `)

      await db.execute(sql`
        UPDATE product_variants v
          JOIN (SELECT variant_id, SUM(quantity) q FROM order_items
                 WHERE order_id IN (${list}) GROUP BY variant_id) i
            ON i.variant_id = v.id
           SET v.stock_qty = v.stock_qty + i.q`)

      await db.delete(payments).where(inArray(payments.orderId, ids))
      await db.execute(sql`DELETE FROM order_items WHERE order_id IN (${list})`)
      await db.execute(sql`DELETE FROM sms_messages WHERE order_id IN (${list})`)
      await db.delete(orders).where(inArray(orders.id, ids))
      console.log(`  · removed ${existing.length} existing order(s), stock returned`)
    }
  }

  const variants = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      stock: productVariants.stockQty,
    })
    .from(productVariants)
    .where(eq(productVariants.isActive, true))
    .limit(40)

  const sellable = variants.filter((v) => v.stock > 0)

  if (sellable.length === 0) {
    console.error('No variant has stock. Raise stock in the admin panel, or re-seed with --demo.')
    process.exit(1)
  }

  const placed: { id: number; number: string; total: number }[] = []

  for (let i = 0; i < SHIPPING.length; i++) {
    const ship = SHIPPING[i]!

    const picks = [sellable[i % sellable.length]!]
    if (i % 2 === 1 && sellable.length > 1) picks.push(sellable[(i + 1) % sellable.length]!)

    const [cartInsert] = await db.insert(carts).values({
      userId: customer.id,
      token: `demo-${Date.now()}-${i}`,
    })
    const cartId = (cartInsert as unknown as { insertId: number }).insertId

    for (const pick of picks) {
      await db.insert(cartItems).values({ cartId, variantId: pick.id, quantity: 1 })
    }

    try {
      const result = await placeOrder(customer.id, cartId, { ...ship, paymentMethod: 'card_to_card' })

      await notifyOrderPlaced(result.orderId)

      placed.push({ id: result.orderId, number: result.orderNumber, total: result.grandTotal })
      console.log(`  ✓ ${result.orderNumber} — ${picks.length} line(s), ${result.grandTotal.toLocaleString('en-US')} تومان`)
    } catch (error) {
      console.error(`  ✗ order ${i + 1} failed:`, (error as Error).message)
    } finally {
      await db.delete(carts).where(eq(carts.id, cartId))
    }
  }

  if (placed.length >= 2) {
    for (const [index, order] of placed.entries()) {
      if (index === 0) continue

      await paymentService.submitReference(customer.id, order.id, `${987654321000 + index}`)
      console.log(`  · ${order.number} — reference code submitted`)
    }
  }

  const system = { id: 0, fullName: 'اسکریپت نمونه' } as never

  if (placed.length >= 4) {
    const [payment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.orderId, placed[3]!.id), eq(payments.status, 'reference_submitted')))
      .limit(1)

    if (payment) {
      await paymentService.approve(system, payment.id, 'تأیید شده در داده نمونه', { ip: '127.0.0.1' })
      console.log(`  · ${placed[3]!.number} — payment approved`)
    }
  }

  if (placed.length >= 5) {
    const [payment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.orderId, placed[4]!.id), eq(payments.status, 'reference_submitted')))
      .limit(1)

    if (payment) {
      await paymentService.approve(system, payment.id, undefined, { ip: '127.0.0.1' })
      for (const status of ['processing', 'shipped', 'delivered'] as const) {
        await paymentService.updateOrderStatus(system, placed[4]!.id, status, { ip: '127.0.0.1' })
      }
      console.log(`  · ${placed[4]!.number} — walked through to delivered`)
    }
  }

  console.log(`\n✓ ${placed.length} demo orders for ${customer.fullName ?? customer.phone}.\n`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
