import { NextResponse } from 'next/server'

import { db } from '@/db'
import { orders, paymentGatewayAttempts, payments } from '@/db/schema'
import { reportError } from '@/lib/errors'
import {
  isGatewayMethod,
  verifyGatewayPayment,
} from '@/modules/payments/gateway-service'
import { and, eq } from 'drizzle-orm'

async function callback(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  const url = new URL(request.url)
  const state = url.searchParams.get('state') ?? ''

  if (!isGatewayMethod(provider) || !/^[a-f0-9]{64}$/.test(state)) {
    return new NextResponse('Invalid payment return', { status: 400 })
  }

  const fields: Record<string, string> = {}
  for (const key of ['trans_id', 'id_get']) fields[key] = url.searchParams.get(key) ?? ''

  if (request.method === 'POST') {
    const declaredLength = Number(request.headers.get('content-length') ?? 0)
    if (declaredLength > 8192) return new NextResponse(null, { status: 413 })
    const body = await request.text()
    if (body.length > 8192) return new NextResponse(null, { status: 413 })
    const posted = new URLSearchParams(body)
    for (const key of ['trans_id', 'id_get']) {
      fields[key] = posted.get(key) ?? fields[key] ?? ''
    }
  }

  let orderId: number | null = null
  let paid = false
  try {
    const result = await verifyGatewayPayment(state, provider, fields)
    orderId = result.orderId
    paid = result.paid
  } catch (error) {
    reportError(error, { action: 'gatewayCallback', provider })
    const [row] = await db
      .select({ orderId: orders.id })
      .from(paymentGatewayAttempts)
      .innerJoin(payments, eq(paymentGatewayAttempts.paymentId, payments.id))
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(
        and(
          eq(paymentGatewayAttempts.state, state),
          eq(paymentGatewayAttempts.provider, provider),
        ),
      )
      .limit(1)
      .catch(() => [])
    orderId = row?.orderId ?? null
  }

  const origin = process.env.APP_URL
  if (!origin?.startsWith('https://')) {
    return new NextResponse('Payment origin is not configured', { status: 503 })
  }
  const path = orderId
    ? `/account/orders/${orderId}?payment=${paid ? 'verified' : 'pending'}`
    : '/account/orders?payment=check'
  return NextResponse.redirect(new URL(path, origin), 303)
}

export const GET = callback
export const POST = callback
