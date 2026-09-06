import 'server-only'

import { and, desc, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  auditLogs,
  orderItems,
  orders,
  payments,
  productVariants,
  products,
  reviews,
  smsMessages,
  users,
} from '@/db/schema'
import { AUDIT_ACTIONS, type AuditAction } from '@/lib/audit'
import { errors } from '@/lib/errors'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/order-status'
import { escapeLike, toLatinDigits } from '@/lib/persian'

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

export async function countForUser(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(eq(orders.userId, userId))

  return Number(row?.count ?? 0)
}

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

function buildOrderSearch(raw: string) {
  const query = toLatinDigits(raw).trim()
  if (!query) return null

  const like = `%${escapeLike(query)}%`
  const clauses = [
    sql`${orders.orderNumber} LIKE ${like}`,
    sql`${orders.shipFullName} LIKE ${like}`,
    sql`REPLACE(REPLACE(${orders.shipPhone}, '-', ''), ' ', '') LIKE ${like}`,
    sql`${orders.shipPostalCode} LIKE ${like}`,
    sql`EXISTS (SELECT 1 FROM payments p WHERE p.order_id = ${orders.id} AND p.reference_code LIKE ${like})`,
  ]

  const digits = query.replace(/\D/g, '')
  if (digits.length > 0 && digits.length <= 15) {
    const sequence = `%${digits.padStart(6, '0')}`
    clauses.push(sql`${orders.orderNumber} LIKE ${sequence}`)

    if (/^\d+$/.test(query) && Number(query) <= Number.MAX_SAFE_INTEGER) {
      clauses.push(sql`${orders.id} = ${Number(query)}`)
    }
  }

  return sql`(${sql.join(clauses, sql` OR `)})`
}

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
    const search = buildOrderSearch(options.search)
    if (search) conditions.push(search)
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

export interface TimelineEvent {
  at: Date
  kind: 'created' | 'status' | 'payment' | 'note' | 'sms'
  title: string
  detail?: string | null
  actor?: string | null
}

export async function timelineForAdmin(orderId: number): Promise<TimelineEvent[]> {
  const [order] = await db
    .select({
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      shippedAt: orders.shippedAt,
      deliveredAt: orders.deliveredAt,
      cancelledAt: orders.cancelledAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) return []

  const [paymentRows, auditRows, smsRows] = await Promise.all([
    db
      .select({
        id: payments.id,
        referenceCode: payments.referenceCode,
        referenceSubmittedAt: payments.referenceSubmittedAt,
      })
      .from(payments)
      .where(eq(payments.orderId, orderId)),

    db
      .select({
        at: auditLogs.createdAt,
        action: auditLogs.action,
        summary: auditLogs.summary,
        actorName: auditLogs.actorName,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .where(
        sql`(${auditLogs.entityType} = 'order' AND ${auditLogs.entityId} = ${String(orderId)})
            OR (${auditLogs.entityType} = 'payment' AND ${auditLogs.entityId} IN (
              SELECT CAST(id AS CHAR) FROM payments WHERE order_id = ${orderId}))`,
      )
      .orderBy(auditLogs.createdAt),

    db
      .select({
        event: smsMessages.event,
        status: smsMessages.status,
        createdAt: smsMessages.createdAt,
        sentAt: smsMessages.sentAt,
      })
      .from(smsMessages)
      .where(eq(smsMessages.orderId, orderId)),
  ])

  const events: TimelineEvent[] = [
    { at: order.createdAt, kind: 'created', title: 'سفارش ثبت شد' },
  ]

  for (const payment of paymentRows) {
    if (payment.referenceSubmittedAt) {
      events.push({
        at: payment.referenceSubmittedAt,
        kind: 'payment',
        title: 'کد رهگیری پرداخت ثبت شد',
        detail: payment.referenceCode,
      })
    }
  }

  for (const row of auditRows) {
    const meta = (row.metadata ?? {}) as { from?: string; to?: string }

    events.push({
      at: row.at,
      kind: row.action === 'order.note' ? 'note' : row.action.startsWith('payment.') ? 'payment' : 'status',
      title: AUDIT_ACTIONS[row.action as AuditAction] ?? row.action,
      detail:
        meta.from && meta.to
          ? `${ORDER_STATUS_LABELS[meta.from as OrderStatus] ?? meta.from} → ${ORDER_STATUS_LABELS[meta.to as OrderStatus] ?? meta.to}`
          : row.summary,
      actor: row.actorName,
    })
  }

  for (const message of smsRows) {
    if (message.status === 'sent' && message.sentAt) {
      events.push({
        at: message.sentAt,
        kind: 'sms',
        title: 'پیامک برای مشتری ارسال شد',
        detail: SMS_EVENT_LABELS[message.event] ?? message.event,
      })
    }
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime())
}

const SMS_EVENT_LABELS: Record<string, string> = {
  order_confirmation: 'تأیید ثبت سفارش',
  payment_approved: 'تأیید پرداخت',
  order_shipped: 'ارسال سفارش',
  otp: 'کد ورود',
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

    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(sql`${users.phoneVerifiedAt} IS NOT NULL`),

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

export async function signupTrend(days = 14) {
  const since = new Date(Date.now() - days * 86_400_000)

  const rows = await db
    .select({
      day: sql<string>`DATE(${users.createdAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(users)
    .where(and(gte(users.createdAt, since), sql`${users.phoneVerifiedAt} IS NOT NULL`))
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(sql`DATE(${users.createdAt})`)

  return rows.map((r) => ({ day: r.day, count: Number(r.count) }))
}
