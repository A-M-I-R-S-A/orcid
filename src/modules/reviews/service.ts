import 'server-only'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  adminUsers,
  orderItems,
  orders,
  products,
  reviewReplies,
  reviews,
  users,
} from '@/db/schema'
import * as audit from '@/lib/audit'
import { MESSAGES, errors } from '@/lib/errors'
import { countsAsPurchase } from '@/lib/order-status'
import type { AdminPrincipal } from '@/lib/permissions'
import { enforce } from '@/lib/rate-limit'

/**
 * Reviews. §37 / §38.
 *
 * ── Ownership ──────────────────────────────────────────────────────────────
 * Every customer-facing mutation is scoped by `userId` in the WHERE clause,
 * not checked after a fetch. "Update where id = X AND user_id = me" cannot
 * touch someone else's row even if the id is guessed, whereas a fetch-then-
 * compare has a window and a forgettable branch.
 */

export interface PublicReview {
  id: number
  rating: number
  title: string | null
  body: string
  authorName: string
  isVerifiedPurchase: boolean
  createdAt: Date
  updatedAt: Date
  reply: { body: string; authorName: string; createdAt: Date } | null
}

/* ── Public reads ───────────────────────────────────────────────────────── */

/** Approved reviews only — pending and rejected are never publicly visible. */
export async function listForProduct(productId: number, limit = 20): Promise<PublicReview[]> {
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      isVerifiedPurchase: reviews.isVerifiedPurchase,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      authorName: users.fullName,
      authorPhone: users.phone,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(and(eq(reviews.productId, productId), eq(reviews.status, 'approved')))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)

  if (rows.length === 0) return []

  const replies = await db
    .select({
      reviewId: reviewReplies.reviewId,
      body: reviewReplies.body,
      createdAt: reviewReplies.createdAt,
      authorName: adminUsers.fullName,
    })
    .from(reviewReplies)
    .innerJoin(adminUsers, eq(reviewReplies.adminUserId, adminUsers.id))
    .where(
      and(
        inArray(reviewReplies.reviewId, rows.map((r) => r.id)),
        eq(reviewReplies.isVisible, true),
      ),
    )

  const replyBy = new Map(replies.map((r) => [r.reviewId, r]))

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    // Never expose a full phone number publicly. A missing name degrades to a
    // masked handle rather than leaking the identifier customers log in with.
    authorName: row.authorName?.trim() || `کاربر ${row.authorPhone.slice(-4)}`,
    isVerifiedPurchase: row.isVerifiedPurchase,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reply: replyBy.has(row.id)
      ? {
          body: replyBy.get(row.id)!.body,
          authorName: replyBy.get(row.id)!.authorName,
          createdAt: replyBy.get(row.id)!.createdAt,
        }
      : null,
  }))
}

/** The current customer's own review, including one still awaiting approval. */
export async function getOwnReview(userId: number, productId: number) {
  const [row] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.productId, productId)))
    .limit(1)
  return row ?? null
}

export async function listOwnReviews(userId: number) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      status: reviews.status,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
    })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt))
}

/* ── Customer mutations ─────────────────────────────────────────────────── */

/** True when the customer has a DELIVERED order containing this product. */
async function hasPurchased(userId: number, productId: number): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.productId, productId),
        eq(orders.status, 'delivered'),
      ),
    )

  return Number(row?.count ?? 0) > 0
}

export async function submit(
  userId: number,
  input: { productId: number; rating: number; title?: string; body: string },
): Promise<{ id: number; isUpdate: boolean }> {
  await enforce(`user:${userId}`, 'review_submit')

  const [product] = await db
    .select({ id: products.id, isActive: products.isActive })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1)

  if (!product || !product.isActive) throw errors.notFound(MESSAGES.productUnavailable)

  const existing = await getOwnReview(userId, input.productId)
  const verified = await hasPurchased(userId, input.productId)

  if (existing) {
    // Editing own review — scoped by userId, so this cannot touch another's.
    await db
      .update(reviews)
      .set({
        rating: input.rating,
        title: input.title || null,
        body: input.body,
        // An edited review returns to moderation; otherwise an approved review
        // could be rewritten into anything after the fact.
        status: 'pending',
        isVerifiedPurchase: verified,
        moderatedByAdminId: null,
        moderatedAt: null,
      })
      .where(and(eq(reviews.id, existing.id), eq(reviews.userId, userId)))

    await recalculateRating(input.productId)
    return { id: existing.id, isUpdate: true }
  }

  const [inserted] = await db.insert(reviews).values({
    productId: input.productId,
    userId,
    rating: input.rating,
    title: input.title || null,
    body: input.body,
    status: 'pending',
    isVerifiedPurchase: verified,
  })

  return { id: (inserted as unknown as { insertId: number }).insertId, isUpdate: false }
}

/* ── Moderation ─────────────────────────────────────────────────────────── */

export async function moderate(
  admin: AdminPrincipal,
  reviewId: number,
  status: 'approved' | 'rejected' | 'hidden',
  meta: { ip?: string } = {},
): Promise<void> {
  const [review] = await db
    .select({ id: reviews.id, productId: reviews.productId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1)

  if (!review) throw errors.notFound()

  await db
    .update(reviews)
    .set({ status, moderatedByAdminId: admin.id, moderatedAt: new Date() })
    .where(eq(reviews.id, reviewId))

  await recalculateRating(review.productId)

  await audit.log({
    actor: admin,
    action: 'review.moderate',
    entityType: 'review',
    entityId: reviewId,
    summary: `دیدگاه ${status === 'approved' ? 'تأیید' : status === 'rejected' ? 'رد' : 'پنهان'} شد`,
    ip: meta.ip,
  })
}

export async function reply(
  admin: AdminPrincipal,
  reviewId: number,
  body: string,
  meta: { ip?: string } = {},
): Promise<void> {
  const [review] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1)

  if (!review) throw errors.notFound()

  // One reply per review, enforced by a unique index — editing replaces.
  await db
    .insert(reviewReplies)
    .values({ reviewId, adminUserId: admin.id, body })
    .onDuplicateKeyUpdate({ set: { body, adminUserId: admin.id } })

  await audit.log({
    actor: admin,
    action: 'review.reply',
    entityType: 'review',
    entityId: reviewId,
    ip: meta.ip,
  })
}

export async function remove(
  admin: AdminPrincipal,
  reviewId: number,
  meta: { ip?: string } = {},
): Promise<void> {
  const [review] = await db
    .select({ productId: reviews.productId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1)

  if (!review) throw errors.notFound()

  await db.delete(reviews).where(eq(reviews.id, reviewId))
  await recalculateRating(review.productId)

  await audit.log({
    actor: admin,
    action: 'review.delete',
    entityType: 'review',
    entityId: reviewId,
    ip: meta.ip,
  })
}

/* ── Rating aggregate ───────────────────────────────────────────────────── */

/**
 * Recomputes the denormalised rating from APPROVED reviews only.
 *
 * Called after every moderation and edit. This is what backs the
 * AggregateRating in structured data, so counting anything unapproved here
 * would put a fabricated rating into the markup — exactly what §62 forbids.
 */
export async function recalculateRating(productId: number): Promise<void> {
  const [row] = await db
    .select({
      sum: sql<number>`COALESCE(SUM(${reviews.rating}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, 'approved')))

  await db
    .update(products)
    .set({ ratingSum: Number(row?.sum ?? 0), ratingCount: Number(row?.count ?? 0) })
    .where(eq(products.id, productId))
}

/* ── Admin queries ──────────────────────────────────────────────────────── */

export async function pendingCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(reviews)
    .where(eq(reviews.status, 'pending'))
  return Number(row?.count ?? 0)
}

export async function listForAdmin(options: { status?: string; page?: number; limit?: number }) {
  const page = Math.max(1, options.page ?? 1)
  const limit = options.limit ?? 30

  const where =
    options.status && options.status !== 'all'
      ? sql`${reviews.status} = ${options.status}`
      : undefined

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        title: reviews.title,
        body: reviews.body,
        status: reviews.status,
        isVerifiedPurchase: reviews.isVerifiedPurchase,
        createdAt: reviews.createdAt,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        authorName: users.fullName,
        authorPhone: users.phone,
        replyBody: reviewReplies.body,
      })
      .from(reviews)
      .innerJoin(products, eq(reviews.productId, products.id))
      .innerJoin(users, eq(reviews.userId, users.id))
      .leftJoin(reviewReplies, eq(reviewReplies.reviewId, reviews.id))
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),

    db.select({ count: sql<number>`COUNT(*)` }).from(reviews).where(where),
  ])

  const total = Number(countRow?.count ?? 0)
  return { items: rows, total, page, pageCount: Math.max(1, Math.ceil(total / limit)) }
}
