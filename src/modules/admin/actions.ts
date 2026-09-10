'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { type ActionResult, fail, ok } from '@/lib/errors'
import { clientIp } from '@/lib/rate-limit'
import { destroyAdminSession } from '@/lib/session'
import { adminLoginSchema, parseOrThrow } from '@/lib/validation'
import * as audit from '@/lib/audit'
import * as payments from '@/modules/payments/service'
import { checkGatewayPaymentForAdmin } from '@/modules/payments/gateway-service'
import * as reviews from '@/modules/reviews/service'
import * as sms from '@/modules/sms/service'
import { requireAdmin, requirePermission, login as loginService } from './auth'
import type { OrderStatus } from '@/lib/order-status'

export async function adminLoginAction(input: {
  username: string
  password: string
}): Promise<ActionResult<void>> {
  try {
    const parsed = await parseOrThrow(adminLoginSchema, input)
    const headerList = await headers()

    await loginService(parsed.username, parsed.password, {
      ip: clientIp(headerList),
      userAgent: headerList.get('user-agent') ?? undefined,
    })

    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'adminLogin' })
  }
}

export async function adminLogoutAction(): Promise<ActionResult<void>> {
  try {
    await destroyAdminSession()
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'adminLogout' })
  }
}

export async function approvePaymentAction(input: {
  paymentId: number
  note?: string
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('payments.approve')
    const headerList = await headers()

    await payments.approve(admin, input.paymentId, input.note, { ip: clientIp(headerList) })

    revalidatePath('/admin/payments')
    revalidatePath('/admin/orders')
    revalidatePath('/admin')

    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'approvePayment', paymentId: input.paymentId })
  }
}

export async function rejectPaymentAction(input: {
  paymentId: number
  reason: string
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('payments.reject')
    const headerList = await headers()

    await payments.reject(admin, input.paymentId, input.reason, { ip: clientIp(headerList) })

    revalidatePath('/admin/payments')
    revalidatePath('/admin/orders')

    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'rejectPayment', paymentId: input.paymentId })
  }
}

export async function checkGatewayPaymentAdminAction(input: {
  orderId: number
}): Promise<ActionResult<{ paid: boolean }>> {
  try {
    await requirePermission('payments.view')
    const result = await checkGatewayPaymentForAdmin(input.orderId)
    revalidatePath(`/admin/orders/${input.orderId}`)
    revalidatePath('/admin/orders')
    revalidatePath('/admin/payments')
    return ok(result)
  } catch (error) {
    return fail(error, { action: 'checkGatewayPaymentAdmin', orderId: input.orderId })
  }
}

export async function updateOrderStatusAction(input: {
  orderId: number
  status: OrderStatus
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('orders.update_status')
    const headerList = await headers()

    await payments.updateOrderStatus(admin, input.orderId, input.status, {
      ip: clientIp(headerList),
    })

    revalidatePath(`/admin/orders/${input.orderId}`)
    revalidatePath('/admin/orders')

    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'updateOrderStatus', orderId: input.orderId })
  }
}

export async function addOrderNoteAction(input: {
  orderId: number
  note: string
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('orders.note')
    const headerList = await headers()

    const { addInternalNote } = await import('@/modules/orders/queries')
    await addInternalNote(input.orderId, input.note)

    await audit.log({
      actor: admin,
      action: 'order.note',
      entityType: 'order',
      entityId: input.orderId,
      ip: clientIp(headerList),
    })

    revalidatePath(`/admin/orders/${input.orderId}`)
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'addOrderNote', orderId: input.orderId })
  }
}

export async function sendOrderSmsAction(input: { orderId: number; messageId: number }): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('sms.approve')
    if (!Number.isInteger(input.orderId) || !Number.isInteger(input.messageId)) throw new Error('شناسه پیامک معتبر نیست.')
    const result = await sms.approveAndDispatchForOrder(input.messageId, input.orderId, admin.id)
    if (result !== 'sent') throw new Error('ارسال پیامک انجام نشد؛ وضعیت خطا را بررسی کنید.')
    revalidatePath(`/admin/orders/${input.orderId}`)
    revalidatePath('/admin/sms')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'sendOrderSms', orderId: input.orderId, messageId: input.messageId })
  }
}

export async function sendShipmentSmsAction(input: { orderId: number; company: string; trackingCode: string }): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('sms.approve')
    const result = await sms.sendShipmentForOrder({ ...input, adminId: admin.id })
    if (result !== 'sent') throw new Error('ارسال پیامک رهگیری انجام نشد؛ وضعیت خطا را بررسی کنید.')
    revalidatePath(`/admin/orders/${input.orderId}`)
    revalidatePath('/admin/orders')
    revalidatePath('/admin/sms')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'sendShipmentSms', orderId: input.orderId })
  }
}

export async function moderateReviewAction(input: {
  reviewId: number
  status: 'approved' | 'rejected' | 'hidden'
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('reviews.moderate')
    const headerList = await headers()

    await reviews.moderate(admin, input.reviewId, input.status, { ip: clientIp(headerList) })

    revalidatePath('/admin/reviews')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'moderateReview', reviewId: input.reviewId })
  }
}

export async function replyToReviewAction(input: {
  reviewId: number
  body: string
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('reviews.reply')
    const headerList = await headers()

    await reviews.reply(admin, input.reviewId, input.body, { ip: clientIp(headerList) })

    revalidatePath('/admin/reviews')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'replyToReview', reviewId: input.reviewId })
  }
}

export async function deleteReviewAction(reviewId: number): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('reviews.delete')
    const headerList = await headers()

    await reviews.remove(admin, reviewId, { ip: clientIp(headerList) })

    revalidatePath('/admin/reviews')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'deleteReview', reviewId })
  }
}

export async function approveSmsAction(messageIds: number[]): Promise<ActionResult<{ approved: number }>> {
  try {
    const admin = await requirePermission('sms.approve')
    const headerList = await headers()

    const approved = await sms.approve(messageIds, admin.id)

    await audit.log({
      actor: admin,
      action: 'sms.approve',
      entityType: 'sms_message',
      summary: `${approved} پیامک تأیید شد`,
      metadata: { count: approved },
      ip: clientIp(headerList),
    })

    revalidatePath('/admin/sms')
    revalidatePath('/admin')

    return ok({ approved })
  } catch (error) {
    return fail(error, { action: 'approveSms' })
  }
}

export async function cancelSmsAction(messageIds: number[]): Promise<ActionResult<{ cancelled: number }>> {
  try {
    await requirePermission('sms.approve')
    const cancelled = await sms.cancel(messageIds)

    revalidatePath('/admin/sms')
    return ok({ cancelled })
  } catch (error) {
    return fail(error, { action: 'cancelSms' })
  }
}

export async function dispatchSmsAction(): Promise<ActionResult<{ sent: number; failed: number }>> {
  try {
    await requirePermission('sms.approve')
    const result = await sms.dispatchPending(30)

    revalidatePath('/admin/sms')
    return ok(result)
  } catch (error) {
    return fail(error, { action: 'dispatchSms' })
  }
}

export async function pingAdminAction(): Promise<ActionResult<{ username: string }>> {
  try {
    const admin = await requireAdmin()
    return ok({ username: admin.username })
  } catch (error) {
    return fail(error, { action: 'pingAdmin' })
  }
}
