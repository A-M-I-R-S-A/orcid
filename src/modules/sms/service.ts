import 'server-only'

import { and, eq, inArray, lt, sql } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import { type SMS_EVENTS, smsMessages, smsTemplates } from '@/db/schema'
import { formatAmountLatin } from '@/lib/money'
import { getProvider } from './provider'

type SmsEvent = (typeof SMS_EVENTS)[number]

export async function sendOtp(phone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const [template] = await db
    .select()
    .from(smsTemplates)
    .where(eq(smsTemplates.event, 'otp_login'))
    .limit(1)

  if (!template?.isEnabled || !template.providerTemplateId) {
    return { ok: false, error: 'سرویس پیامک فعال نیست.' }
  }

  const provider = await getProvider()
  const result = await provider.sendTemplate(phone, template.providerTemplateId, { CODE: code })

  if (!result.success) {
    console.error('[sms] OTP dispatch failed:', result.error)
    return { ok: false, error: 'ارسال پیامک ناموفق بود. لطفاً دوباره تلاش کنید.' }
  }

  return { ok: true }
}

export interface QueueInput {
  event: Exclude<SmsEvent, 'otp_login'>
  phone: string
  payload: Record<string, string>
  orderId?: number
}

export async function enqueue(input: QueueInput): Promise<number | null> {
  const [template] = await db
    .select()
    .from(smsTemplates)
    .where(eq(smsTemplates.event, input.event))
    .limit(1)

  if (!template?.isEnabled) return null

  const status = template.requiresApproval ? 'pending' : 'approved'

  const [result] = await db.insert(smsMessages).values({
    event: input.event,
    phone: input.phone,
    payload: input.payload,
    orderId: input.orderId ?? null,
    status,
  })

  return (result as unknown as { insertId?: number }).insertId ?? null
}

export async function queueOrderConfirmation(params: {
  phone: string
  orderId: number
  orderNumber: string
  total: number
}): Promise<number | null> {
  return enqueue({
    event: 'order_created',
    phone: params.phone,
    orderId: params.orderId,
    payload: {
      ORDER: params.orderNumber,
      AMOUNT: formatAmountLatin(params.total),
    },
  })
}

export async function queuePaymentApproved(params: {
  phone: string
  orderId: number
  orderNumber: string
}): Promise<number | null> {
  return enqueue({
    event: 'payment_approved',
    phone: params.phone,
    orderId: params.orderId,
    payload: { ORDER: params.orderNumber },
  })
}

export async function queueOrderShipped(params: {
  phone: string
  orderId: number
  orderNumber: string
}): Promise<number | null> {
  return enqueue({
    event: 'order_shipped',
    phone: params.phone,
    orderId: params.orderId,
    payload: { ORDER: params.orderNumber },
  })
}

export async function approve(messageIds: number[], adminId: number): Promise<number> {
  if (messageIds.length === 0) return 0

  const result = await db
    .update(smsMessages)
    .set({ status: 'approved', approvedByAdminId: adminId, approvedAt: new Date() })
    .where(and(inArray(smsMessages.id, messageIds), eq(smsMessages.status, 'pending')))

  return affectedRows(result)
}

export async function cancel(messageIds: number[]): Promise<number> {
  if (messageIds.length === 0) return 0

  const result = await db
    .update(smsMessages)
    .set({ status: 'cancelled' })
    .where(and(inArray(smsMessages.id, messageIds), eq(smsMessages.status, 'pending')))

  return affectedRows(result)
}

export async function dispatchPending(limit = 20): Promise<{ sent: number; failed: number }> {
  const candidates = await db
    .select({ id: smsMessages.id })
    .from(smsMessages)
    .where(and(eq(smsMessages.status, 'approved'), lt(smsMessages.attempts, sql`${smsMessages.maxAttempts}`)))
    .orderBy(smsMessages.createdAt)
    .limit(limit)

  let sent = 0
  let failed = 0

  for (const { id } of candidates) {
    const claim = await db
      .update(smsMessages)
      .set({ status: 'sending', attempts: sql`${smsMessages.attempts} + 1` })
      .where(and(eq(smsMessages.id, id), eq(smsMessages.status, 'approved')))

    const claimed = affectedRows(claim)
    if (claimed === 0) continue

    const [message] = await db.select().from(smsMessages).where(eq(smsMessages.id, id)).limit(1)
    if (!message) continue

    const [template] = await db
      .select()
      .from(smsTemplates)
      .where(eq(smsTemplates.event, message.event))
      .limit(1)

    if (!template?.isEnabled || !template.providerTemplateId) {
      await db
        .update(smsMessages)
        .set({ status: 'failed', lastError: 'قالب پیامک غیرفعال یا ناقص است.' })
        .where(eq(smsMessages.id, id))
      failed++
      continue
    }

    const provider = await getProvider()
    const result = await provider.sendTemplate(
      message.phone,
      template.providerTemplateId,
      (message.payload as Record<string, string>) ?? {},
    )

    if (result.success) {
      await db
        .update(smsMessages)
        .set({
          status: 'sent',
          sentAt: new Date(),
          providerMessageId: result.messageId ?? null,
          lastError: null,
        })
        .where(eq(smsMessages.id, id))
      sent++
    } else {
      const exhausted = message.attempts + 1 >= message.maxAttempts
      await db
        .update(smsMessages)
        .set({
          status: result.retryable && !exhausted ? 'approved' : 'failed',
          lastError: result.error?.slice(0, 255) ?? 'ارسال ناموفق',
        })
        .where(eq(smsMessages.id, id))
      failed++
    }
  }

  return { sent, failed }
}

export async function pendingApprovalCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(smsMessages)
    .where(eq(smsMessages.status, 'pending'))
  return Number(row?.count ?? 0)
}

export async function stalledCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(smsMessages)
    .where(eq(smsMessages.status, 'approved'))
  return Number(row?.count ?? 0)
}

export async function failedCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(smsMessages)
    .where(eq(smsMessages.status, 'failed'))
  return Number(row?.count ?? 0)
}
