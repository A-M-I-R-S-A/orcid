import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'

import * as schema from '@/db/schema'

export const TEST_DB = process.env.TEST_DB_NAME

export const hasTestDb = Boolean(TEST_DB)

if (TEST_DB && !/test/i.test(TEST_DB)) {
  throw new Error(
    `Refusing to run integration tests against "${TEST_DB}" — these tests DELETE data. ` +
      `The database name must contain "test".`,
  )
}

let pool: mysql.Pool | undefined

export function testDb() {
  pool ??= mysql.createPool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: TEST_DB,
    charset: 'utf8mb4_unicode_ci',
    connectionLimit: 5,
  })

  return drizzle(pool, { schema, mode: 'default' })
}

export async function closeTestDb() {
  await pool?.end()
  pool = undefined
}

const TRUNCATION_ORDER = [
  'variant_option_values',
  'cart_items',
  'order_items',
  'payments',
  'review_replies',
  'reviews',
  'product_option_values',
  'product_options',
  'product_images',
  'product_categories',
  'product_tags',
  'product_variants',
  'products',
  'categories',
  'carts',
  'orders',
  'sessions',
  'addresses',
  'otp_requests',
  'rate_limits',
  'users',
  'sms_messages',
]

export async function resetTables() {
  const db = testDb()

  await db.execute(`SET FOREIGN_KEY_CHECKS = 0` as never)
  for (const table of TRUNCATION_ORDER) {
    await db.execute(`TRUNCATE TABLE \`${table}\`` as never)
  }
  await db.execute(`SET FOREIGN_KEY_CHECKS = 1` as never)
}

export async function createUser(phone = '09121234567') {
  const db = testDb()
  const [result] = await db.insert(schema.users).values({
    phone,
    phoneVerifiedAt: new Date(),
  })
  return (result as unknown as { insertId: number }).insertId
}

export async function createProductWithVariant(options: {
  name?: string
  price?: number
  stock?: number
}) {
  const db = testDb()

  const [product] = await db.insert(schema.products).values({
    name: options.name ?? 'محصول آزمایشی',
    slug: `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    isActive: true,
  })
  const productId = (product as unknown as { insertId: number }).insertId

  const [variant] = await db.insert(schema.productVariants).values({
    productId,
    sku: `TEST-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    price: options.price ?? 100_000,
    stockQty: options.stock ?? 10,
    isActive: true,
  })
  const variantId = (variant as unknown as { insertId: number }).insertId

  return { productId, variantId }
}

export async function createCart(userId: number) {
  const db = testDb()
  const [cart] = await db.insert(schema.carts).values({
    userId,
    token: `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  })
  return (cart as unknown as { insertId: number }).insertId
}
