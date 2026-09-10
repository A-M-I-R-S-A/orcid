import 'server-only'

import { and, eq, inArray, lt, sql } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import {
  orderItems,
  orders,
  paymentGatewayAttempts,
  payments,
  products,
  productVariants,
  users,
} from '@/db/schema'
import * as audit from '@/lib/audit'
import { MESSAGES, errors } from '@/lib/errors'
import { canAdminTransition, isPayable, shouldRestock } from '@/lib/order-status'
import type { AdminPrincipal } from '@/lib/permissions'
import { enforce } from '@/lib/rate-limit'
import * as sms from '@/modules/sms/service'
import { checkGatewayPaymentForAdmin, isGatewayMethod } from './gateway-service'

export async function submitReference(
  userId: number,
  orderId: number,
  referenceCode: string,
): Promise<void> {
  await enforce(`user:${userId}`, 'payment_reference')

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`)
      const [row] = await tx
        .select({
          orderStatus: orders.status,
          paymentMethod: orders.paymentMethod,
          paymentId: payments.id,
          paymentStatus: payments.status,
        })
        .from(orders)
        .innerJoin(payments, eq(payments.orderId, orders.id))
        .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
        .limit(1)

      if (!row) throw errors.notFound()
      if (!isPayable(row.orderStatus)) throw errors.validation(MESSAGES.orderNotPayable)
      if (isGatewayMethod(row.paymentMethod)) {
        throw errors.validation('شناسه پرداخت دستی برای این روش پرداخت قابل ثبت نیست.')
      }
      if (row.paymentStatus !== 'pending' && row.paymentStatus !== 'rejected') {
        throw errors.conflict('وضعیت پرداخت تغییر کرده است. صفحه را تازه کنید.')
      }

      const paymentChanged = await tx
        .update(payments)
        .set({
          referenceCode,
          referenceSubmittedAt: new Date(),
          status: 'reference_submitted',
          reviewedByAdminId: null,
          reviewedAt: null,
        })
        .where(and(eq(payments.id, row.paymentId), eq(payments.status, row.paymentStatus)))
      if (affectedRows(paymentChanged) === 0) throw errors.conflict('وضعیت پرداخت هم‌زمان تغییر کرده است.')

      const orderChanged = await tx
        .update(orders)
        .set({ status: 'payment_verification', paymentStatus: 'reference_submitted' })
        .where(and(eq(orders.id, orderId), eq(orders.status, row.orderStatus)))
      if (affectedRows(orderChanged) === 0) throw errors.conflict('وضعیت سفارش هم‌زمان تغییر کرده است.')
    })
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw errors.conflict(MESSAGES.referenceDuplicate)
    }
    throw error
  }

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
      method: payments.method,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)

  if (!payment) throw errors.notFound()

  if (isGatewayMethod(payment.method)) {
    throw errors.conflict('پرداخت اینترنتی فقط با تأیید خود درگاه قابل تأیید است.')
  }

  if (payment.status !== 'reference_submitted' || !payment.referenceCode?.trim()) {
    throw errors.conflict('تنها پرداختی که مشتری شناسه آن را ثبت کرده است قابل تأیید است.')
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
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'reference_submitted'), sql`${payments.referenceCode} IS NOT NULL`))

    if (affectedRows(result) === 0) {
      throw errors.conflict('این پرداخت قبلاً بررسی شده است.')
    }

    const orderChanged = await tx
      .update(orders)
      .set({ status: 'paid', paymentStatus: 'approved', paidAt: new Date() })
      .where(and(eq(orders.id, payment.orderId), eq(orders.status, 'payment_verification'), eq(orders.paymentStatus, 'reference_submitted')))
    if (affectedRows(orderChanged) === 0) throw errors.conflict('سفارش دیگر در انتظار تأیید پرداخت نیست.')
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
    .select({
      id: payments.id,
      orderId: payments.orderId,
      status: payments.status,
      method: payments.method,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)

  if (!payment) throw errors.notFound()
  if (isGatewayMethod(payment.method)) {
    throw errors.conflict('پرداخت اینترنتی را نمی‌توان با کنترل دستی رد کرد.')
  }
  if (payment.status !== 'reference_submitted') throw errors.conflict('این پرداخت در انتظار بررسی نیست.')

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
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'reference_submitted')))

    if (affectedRows(result) === 0) {
      throw errors.conflict('این پرداخت هم‌زمان توسط کاربر دیگری بررسی شده است.')
    }

    const orderChanged = await tx
      .update(orders)
      .set({ status: 'rejected', paymentStatus: 'rejected' })
      .where(and(eq(orders.id, payment.orderId), eq(orders.status, 'payment_verification'), eq(orders.paymentStatus, 'reference_submitted')))
    if (affectedRows(orderChanged) === 0) throw errors.conflict('سفارش دیگر در انتظار بررسی پرداخت نیست.')
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

type PaymentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function restoreOrderInventory(tx: PaymentTransaction, orderId: number): Promise<void> {
  const items = await tx
    .select({ variantId: orderItems.variantId, productId: orderItems.productId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))

  for (const item of items) {
    await tx
      .update(productVariants)
      .set({ stockQty: sql`${productVariants.stockQty} + ${item.quantity}` })
      .where(eq(productVariants.id, item.variantId))
    await tx
      .update(products)
      .set({ salesCount: sql`GREATEST(${products.salesCount} - ${item.quantity}, 0)` })
      .where(eq(products.id, item.productId))
  }
}

async function expireOrder(orderId: number, cutoff: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    const changed = await tx
      .update(orders)
      .set({ status: 'cancelled', paymentStatus: 'rejected', cancelledAt: new Date() })
      .where(and(
        eq(orders.id, orderId),
        inArray(orders.status, ['awaiting_payment', 'rejected']),
        inArray(orders.paymentStatus, ['pending', 'rejected']),
        lt(orders.createdAt, cutoff),
      ))
    if (affectedRows(changed) === 0) return false

    await restoreOrderInventory(tx, orderId)
    await tx
      .update(payments)
      .set({ status: 'rejected', adminNote: 'مهلت پرداخت هفت‌روزه به پایان رسید.', reviewedAt: new Date() })
      .where(and(eq(payments.orderId, orderId), inArray(payments.status, ['pending', 'rejected'])))
    await tx
      .update(paymentGatewayAttempts)
      .set({ status: 'failed', lockedUntil: null })
      .where(sql`${paymentGatewayAttempts.paymentId} IN (SELECT id FROM payments WHERE order_id = ${orderId})`)
    return true
  })
}

export async function expireUnpaidOrders(days = 7): Promise<{ expired: number; reconciled: number; skipped: number }> {
  const cutoff = new Date(Date.now() - days * 86_400_000)
  const candidates = await db
    .select({ id: orders.id, method: orders.paymentMethod, gatewayAttemptId: paymentGatewayAttempts.id })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .leftJoin(paymentGatewayAttempts, eq(paymentGatewayAttempts.paymentId, payments.id))
    .where(and(
      inArray(orders.status, ['awaiting_payment', 'rejected']),
      inArray(orders.paymentStatus, ['pending', 'rejected']),
      lt(orders.createdAt, cutoff),
    ))
    .orderBy(orders.createdAt)
    .limit(200)

  let expired = 0
  let reconciled = 0
  let skipped = 0
  for (const order of candidates) {
    if (isGatewayMethod(order.method) && order.gatewayAttemptId) {
      try {
        const result = await checkGatewayPaymentForAdmin(order.id)
        if (result.paid) {
          reconciled += 1
          continue
        }
      } catch {
        skipped += 1
        continue
      }
    }
    if (await expireOrder(order.id, cutoff)) expired += 1
  }
  return { expired, reconciled, skipped }
}

export async function updateOrderStatus(
  admin: AdminPrincipal,
  orderId: number,
  nextStatus: Parameters<typeof canAdminTransition>[1],
  meta: { ip?: string } = {},
): Promise<void> {
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      orderNumber: orders.orderNumber,
      phone: orders.shipPhone,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) throw errors.notFound()

  if (nextStatus === 'cancelled' && order.paymentStatus === 'approved') {
    throw errors.conflict('پیش از لغو سفارش پرداخت‌شده، بازگشت وجه را ثبت کنید.')
  }
  if (nextStatus === 'paid' && order.paymentStatus !== 'approved') {
    throw errors.conflict('سفارش تنها پس از تأیید پرداخت می‌تواند پرداخت‌شده شود.')
  }

  if (isGatewayMethod(order.paymentMethod)) {
    if (nextStatus === 'cancelled') {
      const [attempt] = await db
        .select({ id: paymentGatewayAttempts.id, status: paymentGatewayAttempts.status })
        .from(paymentGatewayAttempts)
        .innerJoin(payments, eq(paymentGatewayAttempts.paymentId, payments.id))
        .where(eq(payments.orderId, orderId))
        .limit(1)
      if (attempt && attempt.status !== 'failed') {
        throw errors.conflict(
          'برای لغو این سفارش ابتدا وضعیت پرداخت و بازگشت وجه را در پنل درگاه بررسی کنید.',
        )
      }
    } else if (order.paymentStatus !== 'approved') {
      throw errors.conflict('پرداخت اینترنتی هنوز توسط درگاه تأیید نشده است.')
    }
  }

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
      await restoreOrderInventory(tx, orderId)
      await tx
        .update(payments)
        .set({ status: 'rejected', adminNote: 'سفارش توسط مدیر لغو شد.', reviewedAt: new Date() })
        .where(and(eq(payments.orderId, orderId), sql`${payments.status} <> 'approved'`))
    }
  })

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
