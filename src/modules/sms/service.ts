import 'server-only'

import { and, eq, inArray, lt, sql } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import { type SMS_EVENTS, smsMessages, smsTemplates } from '@/db/schema'
import { formatAmountLatin } from '@/lib/money'
import { getProvider } from './provider'

type SmsEvent = (typeof SMS_EVENTS)[number]

/**
 * SMS queue and the approval gate. §26 / §27.
 *
 * ── The gate ───────────────────────────────────────────────────────────────
 * `approved` and `sent` are separate states. A queued message CANNOT be
 * dispatched until an administrator approves it, and `dispatchPending` only
 * ever selects rows already in `approved`. The gate is therefore a property of
 * the query, not a check a future caller could forget.
 *
 * OTP is the deliberate exception: it is sent synchronously and never queued,
 * because a customer is waiting on it and because §24 forbids storing the code
 * anywhere — including in a queue row.
 */

/* ── OTP (synchronous, never queued) ────────────────────────────────────── */

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

  // Note what is NOT recorded: no queue row, no log line, nothing carrying the
  // code. Only the outcome is observable.
  if (!result.success) {
    console.error('[sms] OTP dispatch failed:', result.error)
    return { ok: false, error: 'ارسال پیامک ناموفق بود. لطفاً دوباره تلاش کنید.' }
  }

  return { ok: true }
}

/* ── Queue ──────────────────────────────────────────────────────────────── */

export interface QueueInput {
  event: Exclude<SmsEvent, 'otp_login'>
  phone: string
  payload: Record<string, string>
  orderId?: number
}

/**
 * Enqueues a message. Returns null when the event is disabled — a disabled
 * event should leave no trace, not a pile of rows that will never send.
 *
 * The initial status depends on the template's `requiresApproval`: when set,
 * the row lands in `pending` and waits for a human.
 */
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

/** Convenience wrapper for the order-confirmation event. */
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

/* ── Approval ───────────────────────────────────────────────────────────── */

/** §27. Moves pending → approved. Only an administrator reaches this. */
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

/* ── Dispatch ───────────────────────────────────────────────────────────── */

/**
 * Sends approved messages.
 *
 * Called from the cron endpoint if the host has a scheduler, and
 * opportunistically from the admin SMS screen if it does not. Either way the
 * `approved` filter is what enforces the gate.
 *
 * Rows are claimed by a conditional UPDATE before sending, so two workers
 * racing on the same queue cannot both dispatch the same message.
 */
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
    // Claim: only one worker can move this row out of `approved`.
    const claim = await db
      .update(smsMessages)
      .set({ status: 'sending', attempts: sql`${smsMessages.attempts} + 1` })
      .where(and(eq(smsMessages.id, id), eq(smsMessages.status, 'approved')))

    const claimed = affectedRows(claim)
    if (claimed === 0) continue // another worker got there first

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
          // Retryable failures go back to `approved` for another pass; a
          // permanent failure or an exhausted budget stops.
          status: result.retryable && !exhausted ? 'approved' : 'failed',
          lastError: result.error?.slice(0, 255) ?? 'ارسال ناموفق',
        })
        .where(eq(smsMessages.id, id))
      failed++
    }
  }

  return { sent, failed }
}

/* ── Dashboard counters ─────────────────────────────────────────────────── */

export async function pendingApprovalCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(smsMessages)
    .where(eq(smsMessages.status, 'pending'))
  return Number(row?.count ?? 0)
}

/**
 * Approved but still unsent. Surfaced on the dashboard so that a stalled queue
 * — the failure mode when the host has no cron — is visible rather than silent.
 */
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
