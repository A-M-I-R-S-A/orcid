import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { pool } from '@/db'
import * as schema from '@/db/schema'
import { invalidateSettingsCache } from '@/lib/settings'
import {
  addForUser,
  cancelCart,
  getForUser,
  submitForUser,
} from '@/modules/get-later/service'
import {
  closeTestDb,
  createProductWithVariant,
  createUser,
  hasTestDb,
  resetTables,
  testDb,
} from './helpers'

describe.skipIf(!hasTestDb)('get later — customer cart, decision and payment conversion', () => {
  let userId: number

  beforeEach(async () => {
    await resetTables()
    const database = testDb()
    userId = await createUser(`0912${String(Date.now()).slice(-7)}`)

    await database.insert(schema.addresses).values({
      userId,
      fullName: 'مشتری تست',
      phone: '09121234567',
      province: 'تهران',
      city: 'تهران',
      addressLine: 'نشانی کامل مشتری برای آزمون پرداخت بعدی',
      postalCode: '1234567890',
      isDefault: true,
    })
    await database.delete(schema.settings).where(eq(schema.settings.namespace, 'payment_card'))
    await database.delete(schema.settings).where(eq(schema.settings.namespace, 'get_later'))
    await database
      .insert(schema.settings)
      .values([
        { namespace: 'payment_card', key: 'enabled', value: '1' },
        { namespace: 'payment_card', key: 'cardNumber', value: '6037991234567890' },
        { namespace: 'payment_card', key: 'accountHolder', value: 'فروشگاه تست' },
      ])
    await database.insert(schema.settings).values({ namespace: 'get_later', key: 'enabled', value: '1' })
    invalidateSettingsCache()
  })

  afterAll(async () => {
    await closeTestDb()
    await pool.end()
  })

  it('lets the customer create a cart without reserving stock and charges only kept items', async () => {
    const first = await createProductWithVariant({ name: 'نگه‌داشتنی', price: 120_000, stock: 5 })
    const second = await createProductWithVariant({ name: 'بازگشتی', price: 80_000, stock: 5 })
    const database = testDb()
    const cartId = await addForUser(userId, first.variantId, 2)
    expect(await addForUser(userId, second.variantId, 1)).toBe(cartId)
    const [stockBeforeSubmit] = await database.select().from(schema.productVariants).where(eq(schema.productVariants.id, first.variantId))
    expect(stockBeforeSubmit!.stockQty).toBe(5)

    const cart = await getForUser(userId, cartId)
    expect(cart?.items).toHaveLength(2)
    const kept = cart!.items.find((item) => item.variantId === first.variantId)!
    const returned = cart!.items.find((item) => item.variantId === second.variantId)!
    const [address] = await database.select().from(schema.addresses).where(eq(schema.addresses.userId, userId))

    const result = await submitForUser({
      userId,
      cartId,
      addressId: address!.id,
      paymentMethod: 'card_to_card',
      decisions: [
        { itemId: kept.id, decision: 'pay' },
        { itemId: returned.id, decision: 'return' },
      ],
    })

    expect(result.orderId).toBeTypeOf('number')
    const [order] = await database.select().from(schema.orders).where(eq(schema.orders.id, result.orderId!))
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.orderId, result.orderId!))
    const [keptStock] = await database.select().from(schema.productVariants).where(eq(schema.productVariants.id, first.variantId))
    const [returnedStock] = await database.select().from(schema.productVariants).where(eq(schema.productVariants.id, second.variantId))
    expect(order!.grandTotal).toBe(240_000)
    expect(payment!.amount).toBe(240_000)
    expect(keptStock!.stockQty).toBe(3)
    expect(returnedStock!.stockQty).toBe(5)

    const repeated = await submitForUser({
      userId,
      cartId,
      addressId: address!.id,
      paymentMethod: 'card_to_card',
      decisions: [
        { itemId: kept.id, decision: 'pay' },
        { itemId: returned.id, decision: 'return' },
      ],
    })
    const paymentRows = await database.select().from(schema.payments).where(eq(schema.payments.orderId, result.orderId!))
    expect(repeated.orderId).toBe(result.orderId)
    expect(paymentRows).toHaveLength(1)
  })

  it('reuses the customer active cart instead of requiring an admin-created cart', async () => {
    const first = await createProductWithVariant({ price: 100_000, stock: 2 })
    const second = await createProductWithVariant({ price: 110_000, stock: 2 })
    const firstCart = await addForUser(userId, first.variantId, 1)
    const secondCart = await addForUser(userId, second.variantId, 1)
    expect(secondCart).toBe(firstCart)
    expect((await getForUser(userId, firstCart))?.items).toHaveLength(2)
  })

  it('finalizes an all-return decision without creating a payment', async () => {
    const product = await createProductWithVariant({ price: 100_000, stock: 2 })
    const database = testDb()
    const cartId = await addForUser(userId, product.variantId, 2)
    const cart = await getForUser(userId, cartId)

    const result = await submitForUser({
      userId,
      cartId,
      addressId: 0,
      paymentMethod: '',
      decisions: cart!.items.map((item) => ({ itemId: item.id, decision: 'return' as const })),
    })

    expect(result.orderId).toBeNull()
    const finalized = await getForUser(userId, cartId)
    const [stock] = await database.select().from(schema.productVariants).where(eq(schema.productVariants.id, product.variantId))
    expect(finalized?.status).toBe('submitted')
    expect(stock!.stockQty).toBe(2)
  })

  it('cancels a customer cart without changing stock', async () => {
    const product = await createProductWithVariant({ price: 100_000, stock: 4 })
    const database = testDb()
    const cartId = await addForUser(userId, product.variantId, 3)
    await cancelCart(cartId)

    const [stock] = await database.select().from(schema.productVariants).where(eq(schema.productVariants.id, product.variantId))
    const cart = await getForUser(userId, cartId)
    expect(stock!.stockQty).toBe(4)
    expect(cart?.status).toBe('cancelled')
  })
})
