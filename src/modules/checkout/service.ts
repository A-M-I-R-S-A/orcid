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
import { resolveShippingMethod } from '@/lib/shipping-config'
import { calculateShipping, type ShippingConfig } from '@/lib/shipping'
import { enforce } from '@/lib/rate-limit'
import * as sms from '@/modules/sms/service'
import { getEnabledMethods } from '@/modules/payments/registry'

export interface CheckoutInput {
  fullName: string
  phone: string
  province: string
  city: string
  addressLine: string
  postalCode: string
  customerNote?: string
  shippingMethodId?: number
  paymentMethod: string
}

export interface CheckoutResult {
  orderId: number
  orderNumber: string
  grandTotal: number
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function generateOrderNumber(tx: Transaction): Promise<string> {
  const year = jalaliYear()
  const prefix = `ORC-${year}-`

  const [row] = await tx
    .select({
      highest: sql<number | null>`MAX(SUBSTRING(${orders.orderNumber}, ${prefix.length + 1}) + 0)`,
    })
    .from(orders)
    .where(sql`${orders.orderNumber} LIKE ${prefix + '%'}`)

  const sequence = Number(row?.highest ?? 0) + 1
  return prefix + String(sequence).padStart(6, '0')
}

const ORDER_NUMBER_ATTEMPTS = 3

function isDuplicateOrderNumber(error: unknown): boolean {
  const code = (error as { code?: string; errno?: number } | null)?.code
  const errno = (error as { errno?: number } | null)?.errno
  const message = String((error as Error | null)?.message ?? '')

  return (code === 'ER_DUP_ENTRY' || errno === 1062) && message.includes('orders_number_unq')
}

export async function placeOrder(
  userId: number,
  cartId: number,
  input: CheckoutInput,
  quotedGrandTotal?: number,
): Promise<CheckoutResult> {
  await enforce(`user:${userId}`, 'checkout')

  const shippingMethod = await resolveShippingMethod(input.shippingMethodId)
  const enabled = await getEnabledMethods({ amount: quotedGrandTotal })
  if (!enabled.some((m) => m.key === input.paymentMethod)) {
    throw errors.payment(MESSAGES.paymentMethodUnavailable)
  }

  for (let attempt = 1; ; attempt++) {
    try {
      return await placeOrderOnce(userId, cartId, input, shippingMethod, quotedGrandTotal)
    } catch (error) {
      if (attempt >= ORDER_NUMBER_ATTEMPTS || !isDuplicateOrderNumber(error)) throw error
    }
  }
}

async function placeOrderOnce(
  userId: number,
  cartId: number,
  input: CheckoutInput,
  shippingMethod: ShippingConfig & { id: number; name: string },
  quotedGrandTotal?: number,
): Promise<CheckoutResult> {
  return db.transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx)

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

    const merchandiseTotal = subtotal - discountTotal
    const shippingTotal = calculateShipping(merchandiseTotal, shippingMethod)
    const grandTotal = merchandiseTotal + shippingTotal

    if (quotedGrandTotal != null && grandTotal !== quotedGrandTotal) {
      throw errors.validation(MESSAGES.priceChanged)
    }

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

    const [orderInsert] = await tx.insert(orders).values({
      orderNumber,
      userId,
      status: 'awaiting_payment',
      paymentStatus: 'pending',
      paymentMethod: input.paymentMethod,
      subtotal,
      discountTotal,
      shippingTotal,
      shippingMethodId: shippingMethod.id,
      shippingMethodName: shippingMethod.name,
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

    await tx.insert(payments).values({
      orderId,
      userId,
      method: input.paymentMethod,
      status: 'pending',
      amount: grandTotal,
    })

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

export async function notifyOrderPlaced(orderId: number): Promise<void> {
  const [order] = await db
    .select({
      orderNumber: orders.orderNumber,
      grandTotal: orders.grandTotal,
      phone: orders.shipPhone,
      customerName: orders.shipFullName,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) return

  await sms.queueOrderConfirmation({
    phone: order.phone,
    orderId,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
  })
  await sms.queueAdminNewOrderNotification({ orderId, orderNumber: order.orderNumber, stage: 'order_created' })
}

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
