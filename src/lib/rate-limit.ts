import 'server-only'

import { and, eq, lt, sql } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import { rateLimits } from '@/db/schema'
import { errors } from './errors'

/**
 * Fixed-window rate limiting in MariaDB.
 *
 * Redis is assumed unavailable (§84), so the window lives in a table. This is
 * slower than an in-memory counter but it is CORRECT ACROSS WORKERS, which an
 * in-process counter is not — and a limiter that only guards one of four
 * workers is not a limiter.
 *
 * The unique index on (identifier, action) plus an atomic upsert means two
 * concurrent requests cannot both see a fresh window.
 */

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number
  /** Window length in seconds. */
  windowSec: number
}

export const RULES = {
  /** OTP is the expensive one — it costs real money per send. */
  otp_request_phone: { limit: 3, windowSec: 600 },
  otp_request_ip: { limit: 10, windowSec: 600 },
  otp_verify: { limit: 10, windowSec: 600 },

  admin_login: { limit: 8, windowSec: 900 },

  review_submit: { limit: 5, windowSec: 3600 },
  payment_reference: { limit: 10, windowSec: 3600 },
  checkout: { limit: 15, windowSec: 3600 },
  search: { limit: 60, windowSec: 60 },
  contact: { limit: 5, windowSec: 3600 },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitAction = keyof typeof RULES

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

/**
 * Consumes one unit against the window. Returns the outcome rather than
 * throwing, so callers can decide between a hard failure and a soft one.
 */
export async function consume(
  identifier: string,
  action: RateLimitAction,
): Promise<RateLimitResult> {
  const rule = RULES[action]
  const nowMs = Date.now()
  const windowStart = new Date(nowMs)
  const expiresAt = new Date(nowMs + rule.windowSec * 1000)

  const key = identifier.slice(0, 190)

  // Atomic: insert a fresh window, or increment the existing one — but reset
  // the counter first if the stored window has already expired. Doing this in
  // one statement is what makes it race-free.
  await db
    .insert(rateLimits)
    .values({ identifier: key, action, count: 1, windowStart, expiresAt })
    .onDuplicateKeyUpdate({
      set: {
        count: sql`IF(${rateLimits.expiresAt} < NOW(), 1, ${rateLimits.count} + 1)`,
        windowStart: sql`IF(${rateLimits.expiresAt} < NOW(), ${windowStart}, ${rateLimits.windowStart})`,
        expiresAt: sql`IF(${rateLimits.expiresAt} < NOW(), ${expiresAt}, ${rateLimits.expiresAt})`,
      },
    })

  const [row] = await db
    .select({ count: rateLimits.count, expiresAt: rateLimits.expiresAt })
    .from(rateLimits)
    .where(and(eq(rateLimits.identifier, key), eq(rateLimits.action, action)))
    .limit(1)

  const count = row?.count ?? 1
  const resetAt = row?.expiresAt ?? expiresAt

  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    resetAt: new Date(resetAt),
  }
}

/** Consumes and throws a Persian rate-limit error when the window is spent. */
export async function enforce(
  identifier: string,
  action: RateLimitAction,
  message?: string,
): Promise<void> {
  const result = await consume(identifier, action)
  if (!result.allowed) {
    throw errors.rateLimited(message)
  }
}

/**
 * Clears a window after a successful operation — so a customer who mistypes an
 * OTP twice and then succeeds is not still penalised on their next login.
 */
export async function reset(identifier: string, action: RateLimitAction): Promise<void> {
  await db
    .delete(rateLimits)
    .where(and(eq(rateLimits.identifier, identifier.slice(0, 190)), eq(rateLimits.action, action)))
}

/**
 * Deletes expired windows. Called from the cron endpoint, and opportunistically
 * if the host turns out to have no scheduler.
 */
export async function pruneExpired(): Promise<number> {
  const result = await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date()))
  return affectedRows(result)
}

/**
 * Best-effort client IP.
 *
 * Behind a managed host's proxy, the socket address is the proxy, so we read
 * the forwarded headers — taking the FIRST entry, which is the client, not the
 * last, which is trivially spoofable by the client itself.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
