import 'server-only'

import { and, desc, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/db'
import { orderItems, orders, payments, productVariants, products, reviews, users } from '@/db/schema'
import { errors } from '@/lib/errors'

/**
 * Order reads.
 *
 * Customer-facing queries are ALWAYS scoped by userId in the WHERE clause.
 * §36 also governs what comes back: `internalNote` is deliberately absent from
 * every customer projection, because an admin note about a suspicious payment
 * must never surface in the account area.
 */

/* ── Customer ───────────────────────────────────────────────────────────── */

export async function listForUser(userId: number, limit = 50) {
  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      grandTotal: orders.grandTotal,
      createdAt: orders.createdAt,
      itemCount: sql<number>`(SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = ${orders.id})`,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
}

/** Scoped by userId — a guessed order id belongs to nobody. */
export async function getForUser(userId: number, orderId: number) {
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      subtotal: orders.subtotal,
      discountTotal: orders.discountTotal,
      shippingTotal: orders.shippingTotal,
      grandTotal: orders.grandTotal,
      shipFullName: orders.shipFullName,
      shipPhone: orders.shipPhone,
      shipProvince: orders.shipProvince,
      shipCity: orders.shipCity,
      shipAddressLine: orders.shipAddressLine,
      shipPostalCode: orders.shipPostalCode,
      customerNote: orders.customerNote,
      // internalNote is intentionally NOT selected. §36.
      paidAt: orders.paidAt,
      shippedAt: orders.shippedAt,
      deliveredAt: orders.deliveredAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1)

  if (!order) return null

  const [items, [payment]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db
      .select({
        id: payments.id,
        status: payments.status,
        referenceCode: payments.referenceCode,
        referenceSubmittedAt: payments.referenceSubmittedAt,
        // adminNote is exposed ONLY for rejections, where the customer needs
        // to know what to fix. Assembled below rather than selected blindly.
        adminNote: payments.adminNote,
        amount: payments.amount,
      })
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .limit(1),
  ])

  return {
    ...order,
    items,
    payment: payment
      ? {
          id: payment.id,
          status: payment.status,
          referenceCode: payment.referenceCode,
          referenceSubmittedAt: payment.referenceSubmittedAt,
          amount: payment.amount,
          rejectionReason: payment.status === 'rejected' ? payment.adminNote : null,
        }
      : null,
  }
}

export async function getByNumberForUser(userId: number, orderNumber: string) {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), eq(orders.userId, userId)))
    .limit(1)

  return row ? getForUser(userId, row.id) : null
}

/* ── Admin ──────────────────────────────────────────────────────────────── */

export async function listForAdmin(options: {
  status?: string
  search?: string
  page?: number
  limit?: number
}) {
  const page = Math.max(1, options.page ?? 1)
  const limit = options.limit ?? 30
  const conditions = []

  if (options.status && options.status !== 'all') {
    conditions.push(sql`${orders.status} = ${options.status}`)
  }
  if (options.search) {
    const term = `%${options.search}%`
    conditions.push(
      sql`(${orders.orderNumber} LIKE ${term} OR ${orders.shipPhone} LIKE ${term} OR ${orders.shipFullName} LIKE ${term})`,
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        grandTotal: orders.grandTotal,
        customerName: orders.shipFullName,
        customerPhone: orders.shipPhone,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),

    db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(where),
  ])

  const total = Number(countRow?.count ?? 0)
  return { items: rows, total, page, pageCount: Math.max(1, Math.ceil(total / limit)) }
}

export async function getForAdmin(orderId: number) {
  const [order] = await db
    .select({ order: orders, customerPhone: users.phone, customerName: users.fullName, customerId: users.id })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) return null

  const [items, [payment], smsRows] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1),
    db.execute(
      sql`SELECT id, event, status, attempts, last_error, sent_at, created_at
          FROM sms_messages WHERE order_id = ${orderId} ORDER BY created_at DESC`,
    ),
  ])

  return {
    ...order.order,
    customer: { id: order.customerId, phone: order.customerPhone, name: order.customerName },
    items,
    payment: payment ?? null,
    smsMessages: (smsRows as unknown as [Record<string, unknown>[], unknown])[0] ?? [],
  }
}

export async function addInternalNote(orderId: number, note: string): Promise<void> {
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) throw errors.notFound()

  await db.update(orders).set({ internalNote: note }).where(eq(orders.id, orderId))
}

/* ── Dashboard ──────────────────────────────────────────────────────────── */

/**
 * Dashboard counters in ONE round trip rather than a dozen.
 * Revenue counts only orders that actually reached `paid` or beyond — booking
 * revenue on an unverified card-to-card claim would overstate the number that
 * matters most.
 */
export async function dashboardStats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)

  const [
    [orderCounts],
    [revenue],
    [customerCount],
    [productCount],
    lowStock,
    recentOrders,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`COUNT(*)`,
        pending: sql<number>`SUM(CASE WHEN ${orders.status} IN ('pending','awaiting_payment') THEN 1 ELSE 0 END)`,
        verification: sql<number>`SUM(CASE WHEN ${orders.status} = 'payment_verification' THEN 1 ELSE 0 END)`,
        paid: sql<number>`SUM(CASE WHEN ${orders.status} IN ('paid','processing','shipped','delivered') THEN 1 ELSE 0 END)`,
        processing: sql<number>`SUM(CASE WHEN ${orders.status} = 'processing' THEN 1 ELSE 0 END)`,
      })
      .from(orders),

    db
      .select({
        total: sql<number>`COALESCE(SUM(${orders.grandTotal}), 0)`,
        last30: sql<number>`COALESCE(SUM(CASE WHEN ${orders.createdAt} >= ${thirtyDaysAgo} THEN ${orders.grandTotal} ELSE 0 END), 0)`,
      })
      .from(orders)
      .where(sql`${orders.status} IN ('paid','processing','shipped','delivered')`),

    db.select({ count: sql<number>`COUNT(*)` }).from(users),

    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(products)
      .where(and(eq(products.isActive, true), eq(products.isArchived, false))),

    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        sku: productVariants.sku,
        stockQty: productVariants.stockQty,
        threshold: productVariants.lowStockThreshold,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(productVariants.isActive, true),
          eq(products.isArchived, false),
          sql`${productVariants.stockQty} <= ${productVariants.lowStockThreshold}`,
        ),
      )
      .orderBy(productVariants.stockQty)
      .limit(10),

    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        grandTotal: orders.grandTotal,
        customerName: orders.shipFullName,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(8),
  ])

  const [recentReviews] = await Promise.all([
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        status: reviews.status,
        createdAt: reviews.createdAt,
        productName: products.name,
      })
      .from(reviews)
      .innerJoin(products, eq(reviews.productId, products.id))
      .orderBy(desc(reviews.createdAt))
      .limit(5),
  ])

  return {
    orders: {
      total: Number(orderCounts?.total ?? 0),
      pending: Number(orderCounts?.pending ?? 0),
      verification: Number(orderCounts?.verification ?? 0),
      paid: Number(orderCounts?.paid ?? 0),
      processing: Number(orderCounts?.processing ?? 0),
    },
    revenue: {
      total: Number(revenue?.total ?? 0),
      last30: Number(revenue?.last30 ?? 0),
    },
    customerCount: Number(customerCount?.count ?? 0),
    productCount: Number(productCount?.count ?? 0),
    lowStock,
    recentOrders,
    recentReviews,
  }
}

/** New customers per day, for a small dashboard sparkline. */
export async function signupTrend(days = 14) {
  const since = new Date(Date.now() - days * 86_400_000)

  const rows = await db
    .select({
      day: sql<string>`DATE(${users.createdAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(users)
    .where(gte(users.createdAt, since))
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(sql`DATE(${users.createdAt})`)

  return rows.map((r) => ({ day: r.day, count: Number(r.count) }))
}
