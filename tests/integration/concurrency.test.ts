import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'

import * as schema from '@/db/schema'
import { closeTestDb, createCart, createProductWithVariant, createUser, hasTestDb, resetTables, testDb } from './helpers'

describe.skipIf(!hasTestDb)('concurrency and clock regressions', () => {
  beforeEach(async () => {
    await resetTables()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  it('the database session runs in UTC, so SQL NOW() agrees with the JS clock', async () => {
    const db = testDb()

    const [rows] = (await db.execute(
      sql`SELECT UNIX_TIMESTAMP(NOW()) AS db_epoch`,
    )) as unknown as [Record<string, unknown>[], unknown]

    const dbEpoch = Number(rows[0]!.db_epoch)
    const jsEpoch = Math.floor(Date.now() / 1000)

    expect(Math.abs(dbEpoch - jsEpoch)).toBeLessThan(5)
  })

  it('rate limiting actually refuses past the limit', async () => {
    const { consume } = await import('@/lib/rate-limit')

    const key = `probe:${Date.now()}`
    const results = []
    for (let i = 0; i < 5; i++) results.push(await consume(key, 'otp_request_phone'))

    expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true)
    expect(results[3]!.allowed).toBe(false)
    expect(results[4]!.allowed).toBe(false)
  })

  it('never reuses an order number after one is deleted', async () => {
    const db = testDb()
    const { placeOrder } = await import('@/modules/checkout/service')

    for (const [key, value] of [
      ['enabled', '1'],
      ['cardNumber', '6037-0000-0000-0000'],
      ['accountHolder', 'آزمایش'],
    ] as const) {
      await db.execute(
        sql`INSERT INTO settings (namespace, \`key\`, value) VALUES ('payment_card', ${key}, ${value})
            ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      )
    }

    const userId = await createUser()
    const { variantId } = await createProductWithVariant({ stock: 50 })

    const place = async () => {
      const cartId = await createCart(userId)
      await db.insert(schema.cartItems).values({ cartId, variantId, quantity: 1 })
      return placeOrder(
        userId,
        cartId,
        {
          fullName: 'آزمایش',
          phone: '09121234567',
          province: 'تهران',
          city: 'تهران',
          addressLine: 'خیابان آزمایشی، پلاک ۱',
          postalCode: '1234567890',
          paymentMethod: 'card_to_card',
        },
      )
    }

    const first = await place()
    const second = await place()
    const third = await place()

    await db.delete(schema.payments).where(eq(schema.payments.orderId, second.orderId))
    await db.execute(sql`DELETE FROM order_items WHERE order_id = ${second.orderId}`)
    await db.delete(schema.orders).where(eq(schema.orders.id, second.orderId))

    const fourth = await place()

    expect(fourth.orderNumber).not.toBe(third.orderNumber)
    expect(fourth.orderNumber > third.orderNumber).toBe(true)
    expect(new Set([first.orderNumber, third.orderNumber, fourth.orderNumber]).size).toBe(3)
  })

  it('refuses a status change that another operator has already made', async () => {
    const db = testDb()
    const { updateOrderStatus } = await import('@/modules/payments/service')

    const userId = await createUser()
    const [order] = await db.insert(schema.orders).values({
      orderNumber: `ORC-TEST-${Date.now()}`,
      userId,
      status: 'paid',
      paymentStatus: 'approved',
      paymentMethod: 'card_to_card',
      subtotal: 100_000,
      discountTotal: 0,
      shippingTotal: 0,
      grandTotal: 100_000,
      shipFullName: 'آزمایش',
      shipPhone: '09121234567',
      shipProvince: 'تهران',
      shipCity: 'تهران',
      shipAddressLine: 'خیابان آزمایشی',
      shipPostalCode: '1234567890',
    })
    const orderId = (order as unknown as { insertId: number }).insertId

    const admin = { id: 1, fullName: 'مدیر آزمایشی', roleKey: 'superadmin', permissions: [] } as never

    await updateOrderStatus(admin, orderId, 'processing')

    await expect(updateOrderStatus(admin, orderId, 'processing')).rejects.toThrow()

    const [row] = await db
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))

    expect(row?.status).toBe('processing')
  })

  it('cannot reject a payment that has just been approved, and cannot approve twice', async () => {
    const db = testDb()
    const payments = await import('@/modules/payments/service')

    const userId = await createUser()
    const [order] = await db.insert(schema.orders).values({
      orderNumber: `ORC-TEST-${Date.now()}`,
      userId,
      status: 'payment_verification',
      paymentStatus: 'reference_submitted',
      paymentMethod: 'card_to_card',
      subtotal: 100_000,
      discountTotal: 0,
      shippingTotal: 0,
      grandTotal: 100_000,
      shipFullName: 'آزمایش',
      shipPhone: '09121234567',
      shipProvince: 'تهران',
      shipCity: 'تهران',
      shipAddressLine: 'خیابان آزمایشی',
      shipPostalCode: '1234567890',
    })
    const orderId = (order as unknown as { insertId: number }).insertId

    const [payment] = await db.insert(schema.payments).values({
      orderId,
      userId,
      method: 'card_to_card',
      status: 'reference_submitted',
      amount: 100_000,
      referenceCode: `REF-${Date.now()}`,
      referenceSubmittedAt: new Date(),
    })
    const paymentId = (payment as unknown as { insertId: number }).insertId

    const admin = { id: 1, fullName: 'مدیر آزمایشی', roleKey: 'superadmin', permissions: [] } as never

    await payments.approve(admin, paymentId, 'تأیید شد')

    await expect(payments.approve(admin, paymentId, undefined)).rejects.toThrow()

    await expect(payments.reject(admin, paymentId, 'رد شد')).rejects.toThrow()

    const [row] = await db
      .select({ status: schema.payments.status, reference: schema.payments.referenceCode })
      .from(schema.payments)
      .where(eq(schema.payments.id, paymentId))

    expect(row?.status).toBe('approved')
    expect(row?.reference).toBeTruthy()
  })

  it('refuses to approve a payment after the order has already shipped', async () => {
    const db = testDb()
    const payments = await import('@/modules/payments/service')

    const userId = await createUser()
    const [order] = await db.insert(schema.orders).values({
      orderNumber: `ORC-TEST-${Date.now()}`,
      userId,
      status: 'shipped',
      paymentStatus: 'reference_submitted',
      paymentMethod: 'card_to_card',
      subtotal: 100_000,
      discountTotal: 0,
      shippingTotal: 0,
      grandTotal: 100_000,
      shipFullName: 'آزمایش',
      shipPhone: '09121234567',
      shipProvince: 'تهران',
      shipCity: 'تهران',
      shipAddressLine: 'خیابان آزمایشی',
      shipPostalCode: '1234567890',
    })
    const orderId = (order as unknown as { insertId: number }).insertId

    const [payment] = await db.insert(schema.payments).values({
      orderId,
      userId,
      method: 'card_to_card',
      status: 'reference_submitted',
      amount: 100_000,
      referenceCode: `REF-${Date.now()}`,
      referenceSubmittedAt: new Date(),
    })
    const paymentId = (payment as unknown as { insertId: number }).insertId

    const admin = { id: 1, fullName: 'مدیر آزمایشی', roleKey: 'superadmin', permissions: [] } as never

    await expect(payments.approve(admin, paymentId, undefined)).rejects.toThrow()

    const [row] = await db
      .select({ status: schema.orders.status, paymentStatus: schema.orders.paymentStatus })
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))

    expect(row?.status).toBe('shipped')
    expect(row?.paymentStatus).toBe('reference_submitted')
  })

  it('expires an unpaid order once after seven days and restores inventory', async () => {
    const db = testDb()
    const { expireUnpaidOrders } = await import('@/modules/payments/service')
    const userId = await createUser()
    const { productId, variantId } = await createProductWithVariant({ stock: 5 })
    await db.update(schema.productVariants).set({ stockQty: 3 }).where(eq(schema.productVariants.id, variantId))
    await db.update(schema.products).set({ salesCount: 2 }).where(eq(schema.products.id, productId))

    const [order] = await db.insert(schema.orders).values({
      orderNumber: `ORC-EXPIRE-${Date.now()}`,
      userId,
      status: 'awaiting_payment',
      paymentStatus: 'pending',
      paymentMethod: 'card_to_card',
      subtotal: 200_000,
      discountTotal: 0,
      shippingTotal: 0,
      grandTotal: 200_000,
      shipFullName: 'آزمایش',
      shipPhone: '09121234567',
      shipProvince: 'تهران',
      shipCity: 'تهران',
      shipAddressLine: 'خیابان آزمایشی',
      shipPostalCode: '1234567890',
      createdAt: new Date(Date.now() - 8 * 86_400_000),
    })
    const orderId = (order as unknown as { insertId: number }).insertId
    await db.insert(schema.orderItems).values({
      orderId,
      variantId,
      productId,
      productName: 'محصول آزمایشی',
      productSlug: 'test-expiry',
      sku: `EXP-${Date.now()}`,
      unitPrice: 100_000,
      quantity: 2,
      lineTotal: 200_000,
    })
    await db.insert(schema.payments).values({ orderId, userId, method: 'card_to_card', status: 'pending', amount: 200_000 })

    expect(await expireUnpaidOrders(7)).toMatchObject({ expired: 1 })
    expect(await expireUnpaidOrders(7)).toMatchObject({ expired: 0 })

    const [storedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId))
    const [storedPayment] = await db.select().from(schema.payments).where(eq(schema.payments.orderId, orderId))
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, variantId))
    const [product] = await db.select().from(schema.products).where(eq(schema.products.id, productId))
    expect(storedOrder?.status).toBe('cancelled')
    expect(storedPayment?.status).toBe('rejected')
    expect(variant?.stockQty).toBe(5)
    expect(product?.salesCount).toBe(0)
  })
})
