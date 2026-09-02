import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'

import { affectedRows } from '@/db'
import * as schema from '@/db/schema'
import {
  closeTestDb,
  createCart,
  createProductWithVariant,
  createUser,
  hasTestDb,
  resetTables,
  testDb,
} from './helpers'

/**
 * Checkout and inventory integrity. §35.
 *
 * These are the tests that cannot be written against a mock. Row locking,
 * CHECK constraints and transaction rollback are database behaviour; verifying
 * them requires the database.
 */
describe.skipIf(!hasTestDb)('checkout — inventory integrity', () => {
  beforeEach(async () => {
    await resetTables()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  it('refuses to let stock go negative — the CHECK constraint is the backstop', async () => {
    const db = testDb()
    const { variantId } = await createProductWithVariant({ stock: 3 })

    // Bypass the application entirely: this is the database's own guarantee.
    await expect(
      db
        .update(schema.productVariants)
        .set({ stockQty: -1 })
        .where(eq(schema.productVariants.id, variantId)),
    ).rejects.toThrow()

    const [row] = await db
      .select({ stockQty: schema.productVariants.stockQty })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId))

    expect(row?.stockQty).toBe(3)
  })

  it('refuses a conditional decrement below zero without erroring', async () => {
    const db = testDb()
    const { variantId } = await createProductWithVariant({ stock: 2 })

    // This is the exact statement the checkout transaction issues.
    const result = await db
      .update(schema.productVariants)
      .set({ stockQty: sql`${schema.productVariants.stockQty} - 5` })
      .where(
        sql`${schema.productVariants.id} = ${variantId} AND ${schema.productVariants.stockQty} >= 5`,
      )

    // Zero rows affected — the guard held, no exception needed.
    expect(affectedRows(result)).toBe(0)
  })

  it('serialises two concurrent checkouts for the last item', async () => {
    const db = testDb()
    const { variantId } = await createProductWithVariant({ stock: 1 })

    /**
     * Both transactions try to claim the only unit. SELECT ... FOR UPDATE
     * makes the second wait for the first to commit, at which point it sees
     * stock 0 and its guarded UPDATE affects no rows.
     *
     * Without the lock, both would read stock 1 and both would succeed.
     */
    const attempt = async () =>
      db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT stock_qty FROM product_variants WHERE id = ${variantId} FOR UPDATE`,
        )

        const result = await tx
          .update(schema.productVariants)
          .set({ stockQty: sql`${schema.productVariants.stockQty} - 1` })
          .where(
            sql`${schema.productVariants.id} = ${variantId} AND ${schema.productVariants.stockQty} >= 1`,
          )

        return affectedRows(result)
      })

    const results = await Promise.allSettled([attempt(), attempt()])
    const claimed = results
      .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
      .reduce((sum, r) => sum + r.value, 0)

    // Exactly one claim, never two.
    expect(claimed).toBe(1)

    const [row] = await db
      .select({ stockQty: schema.productVariants.stockQty })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId))

    expect(row?.stockQty).toBe(0)
  })

  it('rolls the whole order back when one line fails', async () => {
    const db = testDb()
    const userId = await createUser()
    const { variantId, productId } = await createProductWithVariant({ stock: 5 })

    await expect(
      db.transaction(async (tx) => {
        await tx
          .update(schema.productVariants)
          .set({ stockQty: sql`${schema.productVariants.stockQty} - 2` })
          .where(eq(schema.productVariants.id, variantId))

        const [order] = await tx.insert(schema.orders).values({
          orderNumber: `TEST-ROLLBACK-${Date.now()}`,
          userId,
          paymentMethod: 'card_to_card',
          subtotal: 200_000,
          grandTotal: 200_000,
          shipFullName: 'تست',
          shipPhone: '09121234567',
          shipProvince: 'تهران',
          shipCity: 'تهران',
          shipAddressLine: 'نشانی آزمایشی برای تست',
          shipPostalCode: '1234567890',
        })

        const orderId = (order as unknown as { insertId: number }).insertId

        // A variant that does not exist — the FK is RESTRICT, so this throws.
        await tx.insert(schema.orderItems).values({
          orderId,
          variantId: 999_999_999,
          productId,
          productName: 'تست',
          productSlug: 'test',
          sku: 'X',
          unitPrice: 100_000,
          quantity: 2,
          lineTotal: 200_000,
        })
      }),
    ).rejects.toThrow()

    // Stock must be untouched — the decrement was rolled back with the insert.
    const [variant] = await db
      .select({ stockQty: schema.productVariants.stockQty })
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, variantId))

    expect(variant?.stockQty).toBe(5)

    const orders = await db.select().from(schema.orders).where(eq(schema.orders.userId, userId))
    expect(orders).toHaveLength(0)
  })

  it('keeps order history readable after a product is archived', async () => {
    const db = testDb()
    const userId = await createUser()
    const { variantId, productId } = await createProductWithVariant({ name: 'محصول قدیمی' })

    const [order] = await db.insert(schema.orders).values({
      orderNumber: `TEST-SNAP-${Date.now()}`,
      userId,
      paymentMethod: 'card_to_card',
      subtotal: 100_000,
      grandTotal: 100_000,
      shipFullName: 'تست',
      shipPhone: '09121234567',
      shipProvince: 'تهران',
      shipCity: 'تهران',
      shipAddressLine: 'نشانی آزمایشی برای تست',
      shipPostalCode: '1234567890',
    })
    const orderId = (order as unknown as { insertId: number }).insertId

    await db.insert(schema.orderItems).values({
      orderId,
      variantId,
      productId,
      productName: 'محصول قدیمی',
      productSlug: 'old-product',
      sku: 'OLD-1',
      unitPrice: 100_000,
      quantity: 1,
      lineTotal: 100_000,
    })

    // Rename and archive the product, exactly as an admin would.
    await db
      .update(schema.products)
      .set({ name: 'نام کاملاً جدید', isArchived: true })
      .where(eq(schema.products.id, productId))

    const [item] = await db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId))

    // The snapshot holds — the order still says what was actually bought.
    expect(item?.productName).toBe('محصول قدیمی')
    expect(item?.unitPrice).toBe(100_000)
  })

  it('refuses to delete a variant that appears on an order', async () => {
    const db = testDb()
    const userId = await createUser()
    const { variantId, productId } = await createProductWithVariant({})

    const [order] = await db.insert(schema.orders).values({
      orderNumber: `TEST-FK-${Date.now()}`,
      userId,
      paymentMethod: 'card_to_card',
      subtotal: 100_000,
      grandTotal: 100_000,
      shipFullName: 'تست',
      shipPhone: '09121234567',
      shipProvince: 'تهران',
      shipCity: 'تهران',
      shipAddressLine: 'نشانی آزمایشی برای تست',
      shipPostalCode: '1234567890',
    })

    await db.insert(schema.orderItems).values({
      orderId: (order as unknown as { insertId: number }).insertId,
      variantId,
      productId,
      productName: 'تست',
      productSlug: 'test',
      sku: 'T-1',
      unitPrice: 100_000,
      quantity: 1,
      lineTotal: 100_000,
    })

    // ON DELETE RESTRICT — order history must survive catalogue cleanup.
    await expect(
      db.delete(schema.productVariants).where(eq(schema.productVariants.id, variantId)),
    ).rejects.toThrow()
  })
})

describe.skipIf(!hasTestDb)('unique constraints', () => {
  beforeEach(async () => {
    await resetTables()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  it('rejects a duplicate payment reference — §30, a code cannot be reused', async () => {
    const db = testDb()
    const userId = await createUser()

    const makeOrder = async (n: number) => {
      const [order] = await db.insert(schema.orders).values({
        orderNumber: `TEST-DUP-${Date.now()}-${n}`,
        userId,
        paymentMethod: 'card_to_card',
        subtotal: 100_000,
        grandTotal: 100_000,
        shipFullName: 'تست',
        shipPhone: '09121234567',
        shipProvince: 'تهران',
        shipCity: 'تهران',
        shipAddressLine: 'نشانی آزمایشی برای تست',
        shipPostalCode: '1234567890',
      })
      return (order as unknown as { insertId: number }).insertId
    }

    const first = await makeOrder(1)
    const second = await makeOrder(2)

    await db.insert(schema.payments).values({
      orderId: first,
      userId,
      method: 'card_to_card',
      amount: 100_000,
      referenceCode: 'REF-12345',
    })

    await expect(
      db.insert(schema.payments).values({
        orderId: second,
        userId,
        method: 'card_to_card',
        amount: 100_000,
        referenceCode: 'REF-12345',
      }),
    ).rejects.toThrow()
  })

  it('allows many payments with no reference yet', async () => {
    const db = testDb()
    const userId = await createUser()

    // NULL is not "equal" to NULL in a unique index, so unpaid orders coexist.
    for (let i = 0; i < 3; i++) {
      const [order] = await db.insert(schema.orders).values({
        orderNumber: `TEST-NULL-${Date.now()}-${i}`,
        userId,
        paymentMethod: 'card_to_card',
        subtotal: 100_000,
        grandTotal: 100_000,
        shipFullName: 'تست',
        shipPhone: '09121234567',
        shipProvince: 'تهران',
        shipCity: 'تهران',
        shipAddressLine: 'نشانی آزمایشی برای تست',
        shipPostalCode: '1234567890',
      })

      await db.insert(schema.payments).values({
        orderId: (order as unknown as { insertId: number }).insertId,
        userId,
        method: 'card_to_card',
        amount: 100_000,
        referenceCode: null,
      })
    }

    const rows = await db.select().from(schema.payments)
    expect(rows).toHaveLength(3)
  })

  it('rejects a second review by the same customer on the same product — §37', async () => {
    const db = testDb()
    const userId = await createUser()
    const { productId } = await createProductWithVariant({})

    await db.insert(schema.reviews).values({
      productId,
      userId,
      rating: 5,
      body: 'دیدگاه اول',
    })

    await expect(
      db.insert(schema.reviews).values({
        productId,
        userId,
        rating: 1,
        body: 'دیدگاه دوم',
      }),
    ).rejects.toThrow()
  })

  it('rejects an out-of-range review rating', async () => {
    const db = testDb()
    const userId = await createUser()
    const { productId } = await createProductWithVariant({})

    await expect(
      db.insert(schema.reviews).values({
        productId,
        userId,
        rating: 6,
        body: 'امتیاز نامعتبر',
      }),
    ).rejects.toThrow()
  })

  it('rejects a duplicate cart line for the same variant', async () => {
    const db = testDb()
    const userId = await createUser()
    const cartId = await createCart(userId)
    const { variantId } = await createProductWithVariant({})

    await db.insert(schema.cartItems).values({ cartId, variantId, quantity: 1 })

    await expect(
      db.insert(schema.cartItems).values({ cartId, variantId, quantity: 1 }),
    ).rejects.toThrow()
  })
})
