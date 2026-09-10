import 'server-only'

import { randomBytes } from 'node:crypto'
import { and, eq, isNull, lt, ne, or } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import {
  orderItems,
  orders,
  paymentGatewayAttempts,
  payments,
  users,
} from '@/db/schema'
import { errors } from '@/lib/errors'
import { getBool } from '@/lib/settings'
import * as sms from '@/modules/sms/service'
import {
  assertTorobEligible,
  bitpayRequest,
  getTorobCredentials,
  safeTorobRedirect,
  toRial,
  torobConfigured,
  torobRequest,
  verifyBitpayResponse,
} from './gateway-client'

export const GATEWAY_METHODS = ['torob_pay', 'bitpay'] as const
export type GatewayMethod = (typeof GATEWAY_METHODS)[number]

export function isGatewayMethod(value: string): value is GatewayMethod {
  return (GATEWAY_METHODS as readonly string[]).includes(value)
}

function appOrigin(): string {
  const raw = process.env.APP_URL ?? ''
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw errors.payment('نشانی سایت برای بازگشت از درگاه تنظیم نشده است.')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw errors.payment('نشانی امن HTTPS سایت برای پرداخت تنظیم نشده است.')
  }
  return url.origin
}

async function isGatewayEnabled(provider: GatewayMethod): Promise<boolean> {
  return provider === 'torob_pay'
    ? getBool('torob', 'enabled', false)
    : getBool('bitpay', 'enabled', false)
}

async function existingAttempt(paymentId: number) {
  const [attempt] = await db
    .select()
    .from(paymentGatewayAttempts)
    .where(eq(paymentGatewayAttempts.paymentId, paymentId))
    .limit(1)
  return attempt ?? null
}

export async function startGatewayPayment(
  provider: GatewayMethod,
  orderInput: { id: number; orderNumber: string; amount: number },
): Promise<string> {
  const [row] = await db
    .select({
      paymentId: payments.id,
      paymentStatus: payments.status,
      paymentMethod: payments.method,
      orderStatus: orders.status,
      orderNumber: orders.orderNumber,
      grandTotal: orders.grandTotal,
      subtotal: orders.subtotal,
      discountTotal: orders.discountTotal,
      shippingTotal: orders.shippingTotal,
      customerName: orders.shipFullName,
      customerPhone: orders.shipPhone,
      province: orders.shipProvince,
      city: orders.shipCity,
      address: orders.shipAddressLine,
      postalCode: orders.shipPostalCode,
      accountPhone: users.phone,
    })
    .from(payments)
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .innerJoin(users, eq(orders.userId, users.id))
    .where(and(eq(orders.id, orderInput.id), eq(payments.method, provider)))
    .limit(1)

  if (!row || row.orderNumber !== orderInput.orderNumber || row.grandTotal !== orderInput.amount) {
    throw errors.notFound()
  }
  if (row.paymentStatus !== 'pending' || row.orderStatus !== 'awaiting_payment') {
    throw errors.conflict('این سفارش در وضعیت قابل پرداخت نیست.')
  }

  const state = randomBytes(32).toString('hex')
  const previous = await existingAttempt(row.paymentId)
  let reusableAttemptId: number | null = null
  if (previous) {
    if (previous.status === 'paid') throw errors.conflict('این پرداخت قبلاً تأیید شده است.')
    if (previous.status === 'pending' && previous.redirectUrl) return previous.redirectUrl
    const staleCreating = previous.status === 'creating' && previous.updatedAt.getTime() < Date.now() - 10 * 60_000
    const safeToRetry = previous.status === 'failed' || ((previous.status === 'review' || staleCreating) && !previous.token && !previous.reference)
    if (!safeToRetry) {
      throw errors.conflict('درخواست پرداخت قبلاً ثبت شده و نیازمند بررسی است. وضعیت آن را بررسی کنید یا با پشتیبانی تماس بگیرید.')
    }
    const reset = await db
      .update(paymentGatewayAttempts)
      .set({ provider, amountRial: toRial(row.grandTotal), state, token: null, redirectUrl: null, reference: null, status: 'creating', lockedUntil: null })
      .where(and(eq(paymentGatewayAttempts.id, previous.id), eq(paymentGatewayAttempts.status, previous.status)))
    if (affectedRows(reset) === 0) throw errors.conflict('درخواست پرداخت هم‌زمان تغییر کرده است. دوباره تلاش کنید.')
    reusableAttemptId = previous.id
  }

  if (!(await isGatewayEnabled(provider))) throw errors.payment('این درگاه فعال نیست.')
  const origin = appOrigin()
  if (provider === 'torob_pay') await assertTorobEligible(row.grandTotal)

  let attemptId = reusableAttemptId
  if (attemptId == null) {
    try {
      const [insert] = await db.insert(paymentGatewayAttempts).values({
        paymentId: row.paymentId,
        provider,
        amountRial: toRial(row.grandTotal),
        state,
        status: 'creating',
      })
      attemptId = (insert as unknown as { insertId: number }).insertId
    } catch (error) {
      const raced = await existingAttempt(row.paymentId)
      if (raced?.status === 'pending' && raced.redirectUrl) return raced.redirectUrl
      throw error
    }
  }

  const callback = `${origin}/api/payments/${provider}/callback?state=${state}`

  try {
    let token: string
    let redirectUrl: string

    if (provider === 'bitpay') {
      token = (
        await bitpayRequest('gateway-send', {
          amount: String(toRial(row.grandTotal)),
          redirect: callback,
          factorId: String(attemptId),
          name: row.customerName,
          description: `سفارش ${row.orderNumber}`,
        })
      ).trim()
      if (!/^[1-9][0-9]{0,30}$/.test(token)) {
        throw errors.payment('بیت‌پی درخواست پرداخت را نپذیرفت.')
      }
      redirectUrl = `https://bitpay.ir/payment/gateway-${token}-get`
    } else {
      const credentials = await getTorobCredentials()
      if (!torobConfigured(credentials)) throw errors.payment('درگاه ترب‌پی پیکربندی نشده است.')
      const items = await db
        .select({
          id: orderItems.id,
          productId: orderItems.productId,
          name: orderItems.productName,
          slug: orderItems.productSlug,
          unitPrice: orderItems.unitPrice,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderInput.id))

      const registrationPhone = row.accountPhone.replace(/^0/, '+98')
      const response = await torobRequest(credentials, 'payment/v1/token', {
        amount: toRial(row.grandTotal),
        discountAmount: toRial(row.discountTotal),
        paymentMethodTypeDto: 'INSTALLMENT',
        returnURL: callback,
        transactionId: String(attemptId),
        mobile: row.customerPhone.replace(/^0/, '+98'),
        registration_phone_number: registrationPhone,
        customer_full_name: row.customerName,
        province: row.province,
        city: row.city,
        address: row.address,
        postalCode: row.postalCode,
        cartList: [
          {
            cartId: String(orderInput.id),
            totalAmount: toRial(row.grandTotal),
            taxAmount: 0,
            isTaxIncluded: false,
            shippingAmount: toRial(row.shippingTotal),
            isShipmentIncluded: true,
            cartItems: items.map((item) => ({
              id: String(item.productId),
              product_id: String(item.productId),
              name: item.name,
              count: item.quantity,
              amount: toRial(item.unitPrice),
              category: '',
              page_url: `${origin}/product/${encodeURIComponent(item.slug)}`,
            })),
          },
        ],
      })
      if (typeof response.paymentToken !== 'string' || !response.paymentToken || response.paymentToken.length > 1000) {
        throw errors.payment('پاسخ ترب‌پی معتبر نیست.')
      }
      token = response.paymentToken
      redirectUrl = safeTorobRedirect(response.paymentPageUrl)
    }

    await db
      .update(paymentGatewayAttempts)
      .set({ token, redirectUrl, status: 'pending' })
      .where(eq(paymentGatewayAttempts.id, attemptId))
    return redirectUrl
  } catch (error) {
    await db
      .update(paymentGatewayAttempts)
      .set({ status: 'review' })
      .where(eq(paymentGatewayAttempts.id, attemptId))
    throw error
  }
}

export async function verifyGatewayPayment(
  state: string,
  provider: GatewayMethod,
  fields: Record<string, string> = {},
): Promise<{ orderId: number; paid: boolean }> {
  const [row] = await db
    .select({
      attempt: paymentGatewayAttempts,
      paymentId: payments.id,
      paymentStatus: payments.status,
      orderId: orders.id,
      orderStatus: orders.status,
      orderNumber: orders.orderNumber,
      amount: orders.grandTotal,
      phone: orders.shipPhone,
    })
    .from(paymentGatewayAttempts)
    .innerJoin(payments, eq(paymentGatewayAttempts.paymentId, payments.id))
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .where(and(eq(paymentGatewayAttempts.state, state), eq(paymentGatewayAttempts.provider, provider)))
    .limit(1)

  if (!row) throw errors.notFound('پرداخت پیدا نشد.')
  if (row.attempt.status === 'paid' || row.paymentStatus === 'approved') {
    return { orderId: row.orderId, paid: true }
  }
  if (!row.attempt.token) return { orderId: row.orderId, paid: false }
  if (row.orderStatus !== 'awaiting_payment' || row.paymentStatus !== 'pending') {
    throw errors.conflict('این پرداخت نیازمند بررسی پشتیبانی است.')
  }
  if (row.attempt.amountRial !== toRial(row.amount)) {
    throw errors.conflict('مبلغ پرداخت با سفارش همخوانی ندارد.')
  }

  let reference = row.attempt.reference
  if (provider === 'bitpay' && fields.trans_id) {
    if (fields.id_get !== row.attempt.token || !/^[1-9][0-9]{0,50}$/.test(fields.trans_id)) {
      throw errors.payment('شناسه پرداخت معتبر نیست.')
    }
    if (reference && reference !== fields.trans_id) {
      throw errors.conflict('شناسه پرداخت همخوانی ندارد.')
    }
    reference = fields.trans_id
  }

  const lease = await db
    .update(paymentGatewayAttempts)
    .set({ lockedUntil: new Date(Date.now() + 120_000) })
    .where(
      and(
        eq(paymentGatewayAttempts.id, row.attempt.id),
        ne(paymentGatewayAttempts.status, 'paid'),
        or(
          isNull(paymentGatewayAttempts.lockedUntil),
          lt(paymentGatewayAttempts.lockedUntil, new Date()),
        ),
      ),
    )
  if (affectedRows(lease) === 0) return { orderId: row.orderId, paid: false }

  try {
    if (provider === 'bitpay') {
      if (!reference) return { orderId: row.orderId, paid: false }
      await db
        .update(paymentGatewayAttempts)
        .set({ reference })
        .where(eq(paymentGatewayAttempts.id, row.attempt.id))
      const raw = await bitpayRequest('gateway-result-second', {
        trans_id: reference,
        id_get: row.attempt.token,
        json: '1',
      })
      if (!verifyBitpayResponse(raw, row.attempt.amountRial, String(row.attempt.id))) {
        return { orderId: row.orderId, paid: false }
      }
    } else {
      const credentials = await getTorobCredentials()
      if (!torobConfigured(credentials)) throw errors.payment('اعتبارنامه ترب‌پی در دسترس نیست.')
      let remote = await torobRequest(
        credentials,
        'payment/v1/status',
        { paymentToken: row.attempt.token },
        'GET',
      )
      if (remote.status !== 'SETTLE') {
        if (remote.status !== 'VERIFY') {
          await torobRequest(credentials, 'payment/v1/verify', { paymentToken: row.attempt.token })
        }
        await torobRequest(credentials, 'payment/v1/settle', { paymentToken: row.attempt.token })
        remote = await torobRequest(
          credentials,
          'payment/v1/status',
          { paymentToken: row.attempt.token },
          'GET',
        )
      }
      if (remote.status !== 'SETTLE') return { orderId: row.orderId, paid: false }
      if (remote.amount != null && Number(remote.amount) !== row.attempt.amountRial) {
        throw errors.conflict('مبلغ تأییدشده با سفارش همخوانی ندارد.')
      }
      reference =
        typeof remote.transactionId === 'string' || typeof remote.transactionId === 'number'
          ? String(remote.transactionId)
          : `TP-${row.attempt.id}`
    }

    await db.transaction(async (tx) => {
      const paymentChanged = await tx
        .update(payments)
        .set({
          status: 'approved',
          referenceCode: reference,
          referenceSubmittedAt: new Date(),
          reviewedAt: new Date(),
        })
        .where(and(eq(payments.id, row.paymentId), eq(payments.status, 'pending')))
      if (affectedRows(paymentChanged) === 0) throw errors.conflict('وضعیت پرداخت تغییر کرده است.')

      const orderChanged = await tx
        .update(orders)
        .set({ status: 'paid', paymentStatus: 'approved', paidAt: new Date() })
        .where(and(eq(orders.id, row.orderId), eq(orders.status, 'awaiting_payment')))
      if (affectedRows(orderChanged) === 0) throw errors.conflict('وضعیت سفارش تغییر کرده است.')

      await tx
        .update(paymentGatewayAttempts)
        .set({ status: 'paid', reference })
        .where(eq(paymentGatewayAttempts.id, row.attempt.id))
    })

    await sms.queuePaymentApproved({
      phone: row.phone,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
    })
    return { orderId: row.orderId, paid: true }
  } finally {
    await db
      .update(paymentGatewayAttempts)
      .set({ lockedUntil: null })
      .where(eq(paymentGatewayAttempts.id, row.attempt.id))
  }
}

export async function checkGatewayPaymentForUser(
  orderId: number,
  userId: number,
): Promise<{ paid: boolean }> {
  const [row] = await db
    .select({ state: paymentGatewayAttempts.state, provider: paymentGatewayAttempts.provider })
    .from(paymentGatewayAttempts)
    .innerJoin(payments, eq(paymentGatewayAttempts.paymentId, payments.id))
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1)
  if (!row || !isGatewayMethod(row.provider)) throw errors.notFound('درخواست پرداخت پیدا نشد.')
  const result = await verifyGatewayPayment(row.state, row.provider)
  return { paid: result.paid }
}

export async function checkGatewayPaymentForAdmin(orderId: number): Promise<{ paid: boolean }> {
  const [row] = await db
    .select({ state: paymentGatewayAttempts.state, provider: paymentGatewayAttempts.provider })
    .from(paymentGatewayAttempts)
    .innerJoin(payments, eq(paymentGatewayAttempts.paymentId, payments.id))
    .innerJoin(orders, eq(payments.orderId, orders.id))
    .where(eq(orders.id, orderId))
    .limit(1)
  if (!row || !isGatewayMethod(row.provider)) throw errors.notFound('درخواست پرداخت پیدا نشد.')
  const result = await verifyGatewayPayment(row.state, row.provider)
  return { paid: result.paid }
}
