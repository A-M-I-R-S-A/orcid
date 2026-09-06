import 'server-only'

import { and, eq, sql } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import { orderItems, orders, payments, productVariants, users } from '@/db/schema'
import * as audit from '@/lib/audit'
import { MESSAGES, errors } from '@/lib/errors'
import { canAdminTransition, isPayable, shouldRestock } from '@/lib/order-status'
import type { AdminPrincipal } from '@/lib/permissions'
import { enforce } from '@/lib/rate-limit'
import * as sms from '@/modules/sms/service'

export async function submitReference(
  userId: number,
  orderId: number,
  referenceCode: string,
): Promise<void> {
  await enforce(`user:${userId}`, 'payment_reference')

  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      grandTotal: orders.grandTotal,
      paymentMethod: orders.paymentMethod,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1)

  if (!order) throw errors.notFound()
  if (!isPayable(order.status)) throw errors.validation(MESSAGES.orderNotPayable)

  const [payment] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1)

  if (!payment) throw errors.internal('Order has no payment row')

  const [duplicate] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.referenceCode, referenceCode))
    .limit(1)

  if (duplicate && duplicate.id !== payment.id) {
    throw errors.conflict(MESSAGES.referenceDuplicate)
  }

  try {
    await db
      .update(payments)
      .set({
        referenceCode,
        referenceSubmittedAt: new Date(),
        status: 'reference_submitted',
        reviewedByAdminId: null,
        reviewedAt: null,
      })
      .where(eq(payments.id, payment.id))
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw errors.conflict(MESSAGES.referenceDuplicate)
    }
    throw error
  }

  await db
    .update(orders)
    .set({ status: 'payment_verification', paymentStatus: 'reference_submitted' })
    .where(eq(orders.id, orderId))
}

export async function approve(
  admin: AdminPrincipal,
  paymentId: number,
  note: string | undefined,
  meta: { ip?: string } = {},
): Promise<void> {
  const [payment] = await db
    .select({
      id: payments.id,
      orderId: payments.orderId,
      status: payments.status,
      amount: payments.amount,
      referenceCode: payments.referenceCode,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)

  if (!payment) throw errors.notFound()

  if (payment.status === 'approved') {
    throw errors.conflict('این پرداخت قبلاً تأیید شده است.')
  }

  await db.transaction(async (tx) => {
    const result = await tx
      .update(payments)
      .set({
        status: 'approved',
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
        adminNote: note ?? null,
      })
      .where(and(eq(payments.id, paymentId), sql`${payments.status} <> 'approved'`))

    if (affectedRows(result) === 0) {
      throw errors.conflict('این پرداخت قبلاً بررسی شده است.')
    }

    await tx
      .update(orders)
      .set({ status: 'paid', paymentStatus: 'approved', paidAt: new Date() })
      .where(
        and(
          eq(orders.id, payment.orderId),
          sql`${orders.status} IN ('pending','awaiting_payment','payment_verification','rejected')`,
        ),
      )

    await tx
      .update(orders)
      .set({ paymentStatus: 'approved', paidAt: sql`COALESCE(${orders.paidAt}, NOW())` })
      .where(and(eq(orders.id, payment.orderId), sql`${orders.paymentStatus} <> 'approved'`))
  })

  const [order] = await db
    .select({ orderNumber: orders.orderNumber, phone: orders.shipPhone })
    .from(orders)
    .where(eq(orders.id, payment.orderId))
    .limit(1)

  if (order) {
    await sms.queuePaymentApproved({
      phone: order.phone,
      orderId: payment.orderId,
      orderNumber: order.orderNumber,
    })
  }

  await audit.log({
    actor: admin,
    action: 'payment.approve',
    entityType: 'payment',
    entityId: paymentId,
    summary: `تأیید پرداخت سفارش ${order?.orderNumber ?? payment.orderId}`,
    metadata: { amount: payment.amount, reference: payment.referenceCode },
    ip: meta.ip,
  })
}

export async function reject(
  admin: AdminPrincipal,
  paymentId: number,
  reason: string,
  meta: { ip?: string } = {},
): Promise<void> {
  const [payment] = await db
    .select({ id: payments.id, orderId: payments.orderId, status: payments.status })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)

  if (!payment) throw errors.notFound()
  if (payment.status === 'approved') {
    throw errors.conflict('پرداخت تأییدشده را نمی‌توان رد کرد.')
  }

  await db.transaction(async (tx) => {
    const result = await tx
      .update(payments)
      .set({
        status: 'rejected',
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
        adminNote: reason,
        referenceCode: null,
      })
      .where(and(eq(payments.id, paymentId), sql`${payments.status} <> 'approved'`))

    if (affectedRows(result) === 0) {
      throw errors.conflict('این پرداخت هم‌زمان توسط کاربر دیگری بررسی شده است.')
    }

    await tx
      .update(orders)
      .set({ status: 'rejected', paymentStatus: 'rejected' })
      .where(
        and(
          eq(orders.id, payment.orderId),
          sql`${orders.status} IN ('pending','awaiting_payment','payment_verification')`,
        ),
      )
  })

  await audit.log({
    actor: admin,
    action: 'payment.reject',
    entityType: 'payment',
    entityId: paymentId,
    summary: 'رد پرداخت',
    metadata: { reason },
    ip: meta.ip,
  })
}

export async function updateOrderStatus(
  admin: AdminPrincipal,
  orderId: number,
  nextStatus: Parameters<typeof canAdminTransition>[1],
  meta: { ip?: string } = {},
): Promise<void> {
  const [order] = await db
    .select({ id: orders.id, status: orders.status, orderNumber: orders.orderNumber, phone: orders.shipPhone })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) throw errors.notFound()

  if (!canAdminTransition(order.status, nextStatus)) {
    throw errors.validation('این تغییر وضعیت مجاز نیست.')
  }

  await db.transaction(async (tx) => {
    const timestamps: Record<string, Date> = {}
    if (nextStatus === 'shipped') timestamps.shippedAt = new Date()
    if (nextStatus === 'delivered') timestamps.deliveredAt = new Date()
    if (nextStatus === 'cancelled') timestamps.cancelledAt = new Date()

    const updated = await tx
      .update(orders)
      .set({ status: nextStatus, ...timestamps })
      .where(and(eq(orders.id, orderId), eq(orders.status, order.status)))

    if (affectedRows(updated) === 0) {
      throw errors.conflict(
        'وضعیت این سفارش هم‌زمان توسط کاربر دیگری تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.',
      )
    }

    if (nextStatus === 'cancelled' && shouldRestock(order.status)) {
      const items = await tx
        .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))

      for (const item of items) {
        await tx
          .update(productVariants)
          .set({ stockQty: sql`${productVariants.stockQty} + ${item.quantity}` })
          .where(eq(productVariants.id, item.variantId))
      }
    }
  })

  if (nextStatus === 'shipped') {
    await sms.queueOrderShipped({
      phone: order.phone,
      orderId,
      orderNumber: order.orderNumber,
    })
  }

  await audit.log({
    actor: admin,
    action: 'order.status_change',
    entityType: 'order',
    entityId: orderId,
    summary: `${order.orderNumber}: ${order.status} → ${nextStatus}`,
    metadata: { from: order.status, to: nextStatus },
    ip: meta.ip,
  })
}

export async function pendingPaymentCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(payments)
    .where(eq(payments.status, 'reference_submitted'))
  return Number(row?.count ?? 0)
}

export async function listPayments(options: {
  status?: string
  search?: string
  page?: number
  limit?: number
}) {
  const page = Math.max(1, options.page ?? 1)
  const limit = options.limit ?? 30
  const conditions = []

  if (options.status && options.status !== 'all') {
    conditions.push(sql`${payments.status} = ${options.status}`)
  }
  if (options.search) {
    const term = `%${options.search}%`
    conditions.push(
      sql`(${payments.referenceCode} LIKE ${term} OR ${orders.orderNumber} LIKE ${term} OR ${orders.shipPhone} LIKE ${term})`,
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: payments.id,
        status: payments.status,
        amount: payments.amount,
        method: payments.method,
        referenceCode: payments.referenceCode,
        referenceSubmittedAt: payments.referenceSubmittedAt,
        reviewedAt: payments.reviewedAt,
        adminNote: payments.adminNote,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        orderStatus: orders.status,
        customerName: orders.shipFullName,
        customerPhone: orders.shipPhone,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(where)
      .orderBy(sql`${payments.createdAt} DESC`)
      .limit(limit)
      .offset((page - 1) * limit),

    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(where),
  ])

  const total = Number(countRow?.count ?? 0)
  return { items: rows, total, page, pageCount: Math.max(1, Math.ceil(total / limit)) }
}

export async function getPaymentDetail(paymentId: number) {
  const [row] = await db
    .select({
      payment: payments,
      order: orders,
      customerPhone: users.phone,
      customerName: users.fullName,
    })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .innerJoin(users, eq(payments.userId, users.id))
    .where(eq(payments.id, paymentId))
    .limit(1)

  if (!row) return null

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, row.order.id))

  return { ...row, items }
}
