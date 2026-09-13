import 'server-only'

import { and, eq, inArray, lt, sql } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import { type SMS_EVENTS, orders, smsMessages, smsTemplates } from '@/db/schema'
import { errors } from '@/lib/errors'
import { getSetting } from '@/lib/settings'
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
  customerName: string
}): Promise<number | null> {
  return enqueue({
    event: 'order_created',
    phone: params.phone,
    orderId: params.orderId,
    payload: {
      ORDER: params.orderNumber,
      NAME: params.customerName,
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
  customerName: string
  company?: string
  trackingCode?: string
}): Promise<number | null> {
  return enqueue({
    event: 'order_shipped',
    phone: params.phone,
    orderId: params.orderId,
    payload: {
      ORDER: params.orderNumber,
      NAME: params.customerName,
      SHIPMENT: params.company ?? '',
      TRACK: params.trackingCode ?? '',
    },
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
    const result = await dispatchOne(id)
    if (result === 'sent') sent++
    if (result === 'failed') failed++
  }

  return { sent, failed }
}

export async function queueAdminNewOrderNotification(params: {
  orderId: number
  orderNumber: string
  stage: string
}): Promise<number | null> {
  const [phone, configuredStage] = await Promise.all([
    getSetting('sms', 'adminOrderPhone'),
    getSetting('sms', 'adminOrderTrigger', 'order_created'),
  ])
  if (!/^09\d{9}$/.test(phone) || configuredStage !== params.stage) return null

  return enqueue({
    event: 'admin_new_order',
    phone,
    orderId: params.orderId,
    payload: { ORDER: params.orderNumber },
  })
}

export async function dispatchOne(id: number): Promise<'sent' | 'failed' | 'skipped'> {
    const claim = await db
      .update(smsMessages)
      .set({ status: 'sending', attempts: sql`${smsMessages.attempts} + 1` })
      .where(and(eq(smsMessages.id, id), eq(smsMessages.status, 'approved')))

    const claimed = affectedRows(claim)
    if (claimed === 0) return 'skipped'

    const [message] = await db.select().from(smsMessages).where(eq(smsMessages.id, id)).limit(1)
    if (!message) return 'skipped'

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
      return 'failed'
    }

    const canonicalPayload = (message.payload as Record<string, string>) ?? {}
    const parameterMap = readParameterMap(template.parameters)
    const providerPayload: Record<string, string> = {}
    for (const [field, parameterName] of Object.entries(parameterMap)) {
      providerPayload[parameterName] = canonicalPayload[field] ?? ''
    }
    const provider = await getProvider()
    const result = await provider.sendTemplate(
      message.phone,
      template.providerTemplateId,
      providerPayload,
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
      return 'sent'
    } else {
      const exhausted = message.attempts + 1 >= message.maxAttempts
      await db
        .update(smsMessages)
        .set({
          status: result.retryable && !exhausted ? 'approved' : 'failed',
          lastError: result.error?.slice(0, 255) ?? 'ارسال ناموفق',
        })
        .where(eq(smsMessages.id, id))
      return 'failed'
    }
}

function readParameterMap(value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([field, name]) => typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) && Boolean(field)),
    ) as Record<string, string>
  }
  // Compatibility with templates created before per-field mapping was introduced.
  return Array.isArray(value)
    ? Object.fromEntries(value.filter((name): name is string => typeof name === 'string').map((name) => [name, name]))
    : {}
}

export async function approveAndDispatchForOrder(messageId: number, orderId: number, adminId: number) {
  const [message] = await db
    .select({ id: smsMessages.id, orderId: smsMessages.orderId, status: smsMessages.status })
    .from(smsMessages)
    .where(and(eq(smsMessages.id, messageId), eq(smsMessages.orderId, orderId)))
    .limit(1)
  if (!message) throw errors.notFound('پیامک این سفارش پیدا نشد.')
  if (message.status === 'sent') throw errors.conflict('این پیامک قبلاً ارسال شده است.')
  if (message.status === 'cancelled' || message.status === 'sending') throw errors.conflict('این پیامک اکنون قابل ارسال نیست.')

  await db.update(smsMessages).set({
    status: 'approved',
    attempts: message.status === 'failed' ? 0 : undefined,
    approvedByAdminId: adminId,
    approvedAt: new Date(),
    lastError: null,
  }).where(eq(smsMessages.id, messageId))
  return dispatchOne(messageId)
}

export async function sendShipmentForOrder(input: {
  orderId: number
  adminId: number
  company: string
  trackingCode: string
}) {
  const company = input.company.trim()
  const trackingCode = input.trackingCode.trim()
  if (!company || company.length > 80 || !trackingCode || trackingCode.length > 80) {
    throw errors.validation('شرکت حمل و کد رهگیری را کامل و معتبر وارد کنید.')
  }

  const [order] = await db.select({
    id: orders.id,
    status: orders.status,
    phone: orders.shipPhone,
    orderNumber: orders.orderNumber,
    customerName: orders.shipFullName,
  }).from(orders).where(eq(orders.id, input.orderId)).limit(1)
  if (!order) throw errors.notFound('سفارش پیدا نشد.')
  if (order.status !== 'processing' && order.status !== 'shipped') {
    throw errors.conflict('پیامک رهگیری زمانی قابل ارسال است که سفارش در حال آماده‌سازی باشد.')
  }

  await db.update(orders).set({ shipmentCompany: company, shipmentTrackingCode: trackingCode }).where(eq(orders.id, order.id))

  const [existing] = await db.select({ id: smsMessages.id, status: smsMessages.status })
    .from(smsMessages)
    .where(and(eq(smsMessages.orderId, order.id), eq(smsMessages.event, 'order_shipped')))
    .orderBy(sql`${smsMessages.createdAt} DESC`)
    .limit(1)
  if (existing?.status === 'sent') throw errors.conflict('پیامک رهگیری این سفارش قبلاً ارسال شده است.')

  const messageId = existing?.id ?? await queueOrderShipped({
    phone: order.phone,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    company,
    trackingCode,
  })
  if (!messageId) throw errors.conflict('قالب پیامک رهگیری غیرفعال یا ناقص است.')

  if (existing) {
    await db.update(smsMessages).set({ payload: { ORDER: order.orderNumber, NAME: order.customerName, SHIPMENT: company, TRACK: trackingCode } }).where(eq(smsMessages.id, messageId))
  }
  const result = await approveAndDispatchForOrder(messageId, order.id, input.adminId)
  if (result === 'sent' && order.status === 'processing') {
    await db.update(orders).set({ status: 'shipped', shippedAt: new Date() }).where(and(eq(orders.id, order.id), eq(orders.status, 'processing')))
    await queueAdminNewOrderNotification({ orderId: order.id, orderNumber: order.orderNumber, stage: 'shipped' })
  }
  return result
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
