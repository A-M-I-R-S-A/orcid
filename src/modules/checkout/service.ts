import 'server-only'

import { and, eq, sql } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import {
  cartItems,
  orderItems,
  orders,
  payments,
  productImages,
  productOptionValues,
  productOptions,
  productVariants,
  products,
  users,
  variantOptionValues,
} from '@/db/schema'
import { MESSAGES, errors } from '@/lib/errors'
import { jalaliYear } from '@/lib/jalali'
import { effectivePrice } from '@/lib/money'
import { toPersianDigits } from '@/lib/persian'
import { enforce } from '@/lib/rate-limit'
import * as sms from '@/modules/sms/service'
import { getEnabledMethods } from '@/modules/payments/registry'

/**
 * Checkout. §22 / §35.
 *
 * ── Why this is one transaction ────────────────────────────────────────────
 * Between "the cart page said 5 in stock" and "the order is written", another
 * customer can buy the last one. Reading stock and then writing an order as
 * two separate statements is a race that oversells under exactly the traffic
 * you want.
 *
 * So the whole thing runs inside a transaction that takes a row lock
 * (SELECT ... FOR UPDATE) on every variant before checking or decrementing
 * anything. A second checkout for the same variant blocks until the first
 * commits, then sees the true remaining stock. The CHECK (stock_qty >= 0)
 * constraint is the backstop underneath that: even if this logic were wrong,
 * the database refuses to go negative.
 */

export interface CheckoutInput {
  fullName: string
  phone: string
  province: string
  city: string
  addressLine: string
  postalCode: string
  customerNote?: string
  paymentMethod: string
}

export interface CheckoutResult {
  orderId: number
  orderNumber: string
  grandTotal: number
}

/** ORC-1405-000042 — Jalali year plus a zero-padded sequence. */
async function generateOrderNumber(): Promise<string> {
  const year = jalaliYear()
  const prefix = `ORC-${year}-`

  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(sql`${orders.orderNumber} LIKE ${prefix + '%'}`)

  const sequence = Number(row?.count ?? 0) + 1
  return prefix + String(sequence).padStart(6, '0')
}

export async function placeOrder(
  userId: number,
  cartId: number,
  input: CheckoutInput,
  meta: { ip: string },
): Promise<CheckoutResult> {
  await enforce(`user:${userId}`, 'checkout')

  // The chosen method must be one the administrator has actually enabled —
  // a client can post any string, including a method that is switched off.
  const enabled = await getEnabledMethods()
  if (!enabled.some((m) => m.key === input.paymentMethod)) {
    throw errors.payment(MESSAGES.paymentMethodUnavailable)
  }

  const orderNumber = await generateOrderNumber()

  return db.transaction(async (tx) => {
    const lines = await tx
      .select({
        itemId: cartItems.id,
        quantity: cartItems.quantity,
        variantId: productVariants.id,
        sku: productVariants.sku,
        price: productVariants.price,
        discountPrice: productVariants.discountPrice,
        variantActive: productVariants.isActive,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        productActive: products.isActive,
        productArchived: products.isArchived,
      })
      .from(cartItems)
      .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(cartItems.cartId, cartId))

    if (lines.length === 0) {
      throw errors.validation(MESSAGES.cartEmpty)
    }

    // ── Lock every variant, in a deterministic order ────────────────────────
    // Ordering by id matters: two concurrent checkouts touching the same two
    // variants in opposite orders would deadlock. Sorting makes the lock
    // acquisition order identical for everyone.
    const variantIds = [...new Set(lines.map((l) => l.variantId))].sort((a, b) => a - b)

    const locked = await tx.execute(
      sql`SELECT id, stock_qty, price, discount_price, is_active
          FROM product_variants
          WHERE id IN (${sql.join(variantIds.map((id) => sql`${id}`), sql`, `)})
          ORDER BY id
          FOR UPDATE`,
    )

    const lockedRows = (locked as unknown as [Record<string, unknown>[], unknown])[0] ?? []
    const stockBy = new Map<number, { stock: number; price: number; discount: number | null; active: boolean }>()

    for (const row of lockedRows) {
      stockBy.set(Number(row.id), {
        stock: Number(row.stock_qty),
        price: Number(row.price),
        discount: row.discount_price == null ? null : Number(row.discount_price),
        active: Boolean(row.is_active),
      })
    }

    // ── Validate against the LOCKED rows, not the earlier read ──────────────
    let subtotal = 0
    let discountTotal = 0

    const prepared: {
      variantId: number
      productId: number
      productName: string
      productSlug: string
      sku: string
      unitPrice: number
      quantity: number
      lineTotal: number
    }[] = []

    for (const line of lines) {
      const live = stockBy.get(line.variantId)

      if (!live || !live.active || !line.productActive || line.productArchived) {
        throw errors.validation(`«${line.productName}» دیگر در دسترس نیست. لطفاً سبد خرید را بررسی کنید.`)
      }

      if (live.stock < line.quantity) {
        throw errors.outOfStock(
          live.stock === 0
            ? `«${line.productName}» موجود نیست. لطفاً آن را از سبد خرید حذف کنید.`
            : `از «${line.productName}» تنها ${toPersianDigits(live.stock)} عدد موجود است.`,
        )
      }

      // Price comes from the locked row — never from the cart, never from the
      // client. A price changed since the cart was rendered is applied here.
      const unitPrice = effectivePrice(live.price, live.discount)
      const lineTotal = unitPrice * line.quantity

      subtotal += live.price * line.quantity
      discountTotal += (live.price - unitPrice) * line.quantity

      prepared.push({
        variantId: line.variantId,
        productId: line.productId,
        productName: line.productName,
        productSlug: line.productSlug,
        sku: line.sku,
        unitPrice,
        quantity: line.quantity,
        lineTotal,
      })
    }

    const grandTotal = subtotal - discountTotal

    // ── Decrement stock ────────────────────────────────────────────────────
    // The WHERE clause repeats the stock check, so even if the logic above
    // were wrong this UPDATE affects zero rows rather than overselling.
    for (const item of prepared) {
      const result = await tx
        .update(productVariants)
        .set({ stockQty: sql`${productVariants.stockQty} - ${item.quantity}` })
        .where(
          and(
            eq(productVariants.id, item.variantId),
            sql`${productVariants.stockQty} >= ${item.quantity}`,
          ),
        )

      if (affectedRows(result) === 0) {
        throw errors.outOfStock(`موجودی «${item.productName}» کافی نیست.`)
      }
    }

    // ── Write the order ────────────────────────────────────────────────────
    const [orderInsert] = await tx.insert(orders).values({
      orderNumber,
      userId,
      status: 'awaiting_payment',
      paymentStatus: 'pending',
      paymentMethod: input.paymentMethod,
      subtotal,
      discountTotal,
      shippingTotal: 0,
      grandTotal,
      shipFullName: input.fullName,
      shipPhone: input.phone,
      shipProvince: input.province,
      shipCity: input.city,
      shipAddressLine: input.addressLine,
      shipPostalCode: input.postalCode,
      customerNote: input.customerNote || null,
    })

    const orderId = (orderInsert as unknown as { insertId: number }).insertId

    // Variant labels and images are snapshotted onto the item, so the order
    // stays readable after the product is renamed or archived.
    const variantLabels = await tx
      .select({
        variantId: variantOptionValues.variantId,
        optionName: productOptions.name,
        value: productOptionValues.value,
      })
      .from(variantOptionValues)
      .innerJoin(productOptions, eq(variantOptionValues.optionId, productOptions.id))
      .innerJoin(productOptionValues, eq(variantOptionValues.optionValueId, productOptionValues.id))
      .where(
        sql`${variantOptionValues.variantId} IN (${sql.join(
          variantIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .orderBy(productOptions.sortOrder)

    const labelBy = new Map<number, string[]>()
    for (const row of variantLabels) {
      const list = labelBy.get(row.variantId) ?? []
      list.push(`${row.optionName}: ${row.value}`)
      labelBy.set(row.variantId, list)
    }

    const productIds = [...new Set(prepared.map((p) => p.productId))]
    const images = await tx
      .select({
        productId: productImages.productId,
        path: productImages.path,
        isPrimary: productImages.isPrimary,
      })
      .from(productImages)
      .where(
        sql`${productImages.productId} IN (${sql.join(
          productIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .orderBy(sql`${productImages.isPrimary} DESC`, productImages.sortOrder)

    const imageBy = new Map<number, string>()
    for (const image of images) {
      if (!imageBy.has(image.productId)) imageBy.set(image.productId, image.path)
    }

    await tx.insert(orderItems).values(
      prepared.map((item) => ({
        orderId,
        variantId: item.variantId,
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        variantLabel: (labelBy.get(item.variantId) ?? []).join(' • ') || null,
        sku: item.sku,
        imagePath: imageBy.get(item.productId) ?? null,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
    )

    // A pending payment row exists from the moment the order does, so the
    // admin payment queue is complete without a later backfill.
    await tx.insert(payments).values({
      orderId,
      userId,
      method: input.paymentMethod,
      status: 'pending',
      amount: grandTotal,
    })

    // Bump sales counters for the "popular" sort.
    for (const item of prepared) {
      await tx
        .update(products)
        .set({ salesCount: sql`${products.salesCount} + ${item.quantity}` })
        .where(eq(products.id, item.productId))
    }

    await tx.delete(cartItems).where(eq(cartItems.cartId, cartId))

    return { orderId, orderNumber, grandTotal }
  })
}

/**
 * Queues the confirmation SMS.
 *
 * Called AFTER the transaction commits, deliberately. Enqueuing inside it
 * would mean a rolled-back order could still have queued a message, and an
 * SMS provider outage could roll back a perfectly good order.
 */
export async function notifyOrderPlaced(orderId: number): Promise<void> {
  const [order] = await db
    .select({
      orderNumber: orders.orderNumber,
      grandTotal: orders.grandTotal,
      phone: orders.shipPhone,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) return

  await sms.queueOrderConfirmation({
    phone: order.phone,
    orderId,
    orderNumber: order.orderNumber,
    total: order.grandTotal,
  })
}

/** Prefills checkout from the customer's most recent order. */
export async function lastUsedAddress(userId: number) {
  const [order] = await db
    .select({
      fullName: orders.shipFullName,
      phone: orders.shipPhone,
      province: orders.shipProvince,
      city: orders.shipCity,
      addressLine: orders.shipAddressLine,
      postalCode: orders.shipPostalCode,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(sql`${orders.createdAt} DESC`)
    .limit(1)

  if (order) return order

  const [user] = await db
    .select({ fullName: users.fullName, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user ? { fullName: user.fullName ?? '', phone: user.phone } : null
}
