import 'server-only'

import { and, desc, eq, sql } from 'drizzle-orm'

import { affectedRows, db, transaction } from '@/db'
import { addresses, users, wishlistItems } from '@/db/schema'
import { MESSAGES, errors } from '@/lib/errors'
import { listProductsByIds } from '@/modules/catalog/queries'
import type { ProductCard } from '@/modules/catalog/queries'

const MAX_ADDRESSES = 10

export interface ProfileSummary {
  fullName: string | null
  email: string | null
  phone: string
  hasPassword: boolean
  createdAt: Date
}

export async function getProfile(userId: number): Promise<ProfileSummary> {
  const [row] = await db
    .select({
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!row) throw errors.notFound()

  return {
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    hasPassword: Boolean(row.passwordHash),
    createdAt: row.createdAt,
  }
}

export async function updateProfile(
  userId: number,
  input: { fullName: string; email?: string },
): Promise<void> {
  await db
    .update(users)
    .set({
      fullName: input.fullName,
      email: input.email ? input.email : null,
    })
    .where(eq(users.id, userId))
}

export type Address = typeof addresses.$inferSelect

export async function listAddresses(userId: number): Promise<Address[]> {
  return db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt))
}

export async function getAddress(userId: number, id: number): Promise<Address | null> {
  const [row] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
    .limit(1)

  return row ?? null
}

export interface AddressInput {
  fullName: string
  phone: string
  province: string
  city: string
  addressLine: string
  postalCode: string
  notes?: string
  isDefault?: boolean
}

export async function createAddress(userId: number, input: AddressInput): Promise<number> {
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(addresses)
    .where(eq(addresses.userId, userId))

  const existing = Number(countRow?.count ?? 0)

  if (existing >= MAX_ADDRESSES) {
    throw errors.validation(
      `حداکثر ${MAX_ADDRESSES} نشانی می‌توانید ذخیره کنید. یکی را حذف کنید.`,
    )
  }

  const shouldDefault = input.isDefault || existing === 0

  return transaction(async (tx) => {
    if (shouldDefault) {
      await tx
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, userId))
    }

    const [inserted] = await tx.insert(addresses).values({
      userId,
      fullName: input.fullName,
      phone: input.phone,
      province: input.province,
      city: input.city,
      addressLine: input.addressLine,
      postalCode: input.postalCode,
      notes: input.notes || null,
      isDefault: shouldDefault,
    })

    return (inserted as unknown as { insertId: number }).insertId
  })
}

export async function updateAddress(
  userId: number,
  id: number,
  input: AddressInput,
): Promise<void> {
  await transaction(async (tx) => {
    if (input.isDefault) {
      await tx
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, userId))
    }

    const result = await tx
      .update(addresses)
      .set({
        fullName: input.fullName,
        phone: input.phone,
        province: input.province,
        city: input.city,
        addressLine: input.addressLine,
        postalCode: input.postalCode,
        notes: input.notes || null,
        ...(input.isDefault ? { isDefault: true } : {}),
      })
      .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))

    if (affectedRows(result) === 0) {
      throw errors.notFound(MESSAGES.notFound)
    }
  })
}

export async function deleteAddress(userId: number, id: number): Promise<void> {
  await transaction(async (tx) => {
    const [row] = await tx
      .select({ isDefault: addresses.isDefault })
      .from(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
      .limit(1)

    if (!row) throw errors.notFound(MESSAGES.notFound)

    await tx.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId)))

    if (row.isDefault) {
      const [next] = await tx
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.userId, userId))
        .orderBy(desc(addresses.createdAt))
        .limit(1)

      if (next) {
        await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id))
      }
    }
  })
}

export async function setDefaultAddress(userId: number, id: number): Promise<void> {
  await transaction(async (tx) => {
    const result = await tx
      .update(addresses)
      .set({ isDefault: true })
      .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))

    if (affectedRows(result) === 0) throw errors.notFound(MESSAGES.notFound)

    await tx
      .update(addresses)
      .set({ isDefault: false })
      .where(and(eq(addresses.userId, userId), sql`${addresses.id} <> ${id}`))
  })
}

export async function toggleWishlist(
  userId: number,
  productId: number,
): Promise<{ saved: boolean }> {
  const removed = await db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)))

  if (affectedRows(removed) > 0) {
    return { saved: false }
  }

  try {
    await db.insert(wishlistItems).values({ userId, productId })
    return { saved: true }
  } catch (error) {
    if (isDuplicateKey(error)) return { saved: true }
    if (isForeignKey(error)) throw errors.notFound(MESSAGES.productUnavailable)
    throw error
  }
}

export async function isWishlisted(userId: number, productId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: wishlistItems.id })
    .from(wishlistItems)
    .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)))
    .limit(1)

  return Boolean(row)
}

export async function wishlistedIds(
  userId: number,
  productIds: number[],
): Promise<Set<number>> {
  if (productIds.length === 0) return new Set()

  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(
      and(
        eq(wishlistItems.userId, userId),
        sql`${wishlistItems.productId} IN (${sql.join(
          productIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ),
    )

  return new Set(rows.map((r) => r.productId))
}

export async function listWishlist(userId: number): Promise<ProductCard[]> {
  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt))
    .limit(200)

  return listProductsByIds(rows.map((r) => r.productId))
}

export async function wishlistCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))

  return Number(row?.count ?? 0)
}

export async function addressCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(addresses)
    .where(eq(addresses.userId, userId))

  return Number(row?.count ?? 0)
}

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: string })?.code === 'ER_DUP_ENTRY'
}

function isForeignKey(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_NO_REFERENCED_ROW'
}
