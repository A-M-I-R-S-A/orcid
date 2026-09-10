import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import * as schema from '@/db/schema'
import { invalidateSettingsCache, setMany } from '@/lib/settings'
import {
  startGatewayPayment,
  verifyGatewayPayment,
} from '@/modules/payments/gateway-service'
import {
  closeTestDb,
  createUser,
  hasTestDb,
  resetTables,
  testDb,
} from './helpers'

describe.skipIf(!hasTestDb)('payment gateways', () => {
  beforeEach(async () => {
    await resetTables()
    vi.stubEnv('APP_URL', 'https://shop.example')
    await setMany('bitpay', { enabled: '1', apiKey: 'test-api-key' }, ['apiKey'])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    invalidateSettingsCache()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  it('persists a BitPay attempt and marks the order paid only after exact verification', async () => {
    const db = testDb()
    const userId = await createUser()
    const orderNumber = `BITPAY-${Date.now()}`
    const [orderInsert] = await db.insert(schema.orders).values({
      orderNumber,
      userId,
      paymentMethod: 'bitpay',
      subtotal: 100_000,
      grandTotal: 100_000,
      shipFullName: 'کاربر آزمایشی',
      shipPhone: '09121234567',
      shipProvince: 'تهران',
      shipCity: 'تهران',
      shipAddressLine: 'خیابان آزمایشی، پلاک ۱۲',
      shipPostalCode: '1234567890',
    })
    const orderId = (orderInsert as unknown as { insertId: number }).insertId
    const [paymentInsert] = await db.insert(schema.payments).values({
      orderId,
      userId,
      method: 'bitpay',
      amount: 100_000,
    })
    const paymentId = (paymentInsert as unknown as { insertId: number }).insertId

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = String(url)
        if (href.endsWith('/gateway-send')) return new Response('12345')

        const [attempt] = await db
          .select({ id: schema.paymentGatewayAttempts.id })
          .from(schema.paymentGatewayAttempts)
          .where(eq(schema.paymentGatewayAttempts.paymentId, paymentId))
        if (!attempt) throw new Error('Expected persisted gateway attempt')
        return new Response(
          JSON.stringify({ status: 1, amount: 1_000_000, factorId: String(attempt.id) }),
        )
      }),
    )

    const redirectUrl = await startGatewayPayment('bitpay', {
      id: orderId,
      orderNumber,
      amount: 100_000,
    })

    expect(redirectUrl).toBe('https://bitpay.ir/payment/gateway-12345-get')
    const [attempt] = await db
      .select()
      .from(schema.paymentGatewayAttempts)
      .where(eq(schema.paymentGatewayAttempts.paymentId, paymentId))
    if (!attempt) throw new Error('Expected persisted gateway attempt')

    const result = await verifyGatewayPayment(attempt.state, 'bitpay', {
      trans_id: '987654',
      id_get: '12345',
    })
    expect(result).toEqual({ orderId, paid: true })

    const [[order], [payment]] = await Promise.all([
      db.select().from(schema.orders).where(eq(schema.orders.id, orderId)),
      db.select().from(schema.payments).where(eq(schema.payments.id, paymentId)),
    ])
    if (!order || !payment) throw new Error('Expected persisted order and payment')
    expect(order.status).toBe('paid')
    expect(order.paymentStatus).toBe('approved')
    expect(payment.status).toBe('approved')
    expect(payment.referenceCode).toBe('987654')
  })
})
