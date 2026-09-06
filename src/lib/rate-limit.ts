import 'server-only'

import { and, eq, lt, sql } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import { rateLimits } from '@/db/schema'
import { errors } from './errors'

export interface RateLimitRule {
  limit: number
  windowSec: number
}

export const RULES = {
  otp_request_phone: { limit: 3, windowSec: 600 },
  otp_request_ip: { limit: 10, windowSec: 600 },
  otp_verify: { limit: 10, windowSec: 600 },

  admin_login: { limit: 8, windowSec: 900 },

  login_password_phone: { limit: 10, windowSec: 900 },
  login_password_ip: { limit: 40, windowSec: 900 },

  password_reset: { limit: 4, windowSec: 3600 },

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

export async function consume(
  identifier: string,
  action: RateLimitAction,
): Promise<RateLimitResult> {
  const rule = RULES[action]
  const nowMs = Date.now()
  const windowStart = new Date(nowMs)
  const expiresAt = new Date(nowMs + rule.windowSec * 1000)

  const key = identifier.slice(0, 190)

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

export async function reset(identifier: string, action: RateLimitAction): Promise<void> {
  await db
    .delete(rateLimits)
    .where(and(eq(rateLimits.identifier, identifier.slice(0, 190)), eq(rateLimits.action, action)))
}

export async function pruneExpired(): Promise<number> {
  const result = await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date()))
  return affectedRows(result)
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
