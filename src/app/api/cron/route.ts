import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

import { pruneAbandoned } from '@/modules/cart/service'
import { pruneExpiredOtps } from '@/modules/auth/service'
import { dispatchPending } from '@/modules/sms/service'
import { pruneExpired as pruneRateLimits } from '@/lib/rate-limit'
import { pruneSessions } from '@/lib/session'

/**
 * Scheduled maintenance. §84 / planning §N-3.
 *
 * The host may or may not have cron — it was never verified. So this is an
 * HTTP endpoint that works either way:
 *
 *   - with cron:    curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron
 *   - without cron: the admin SMS screen calls dispatchPending directly, and
 *                   an external scheduler (or a manual call) can hit this URL.
 *
 * Everything here is idempotent, so running it twice is harmless and a missed
 * run simply catches up on the next one.
 */
export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const presented = header.startsWith('Bearer ') ? header.slice(7) : ''

  const a = Buffer.from(presented)
  const b = Buffer.from(secret)

  // Length check first — timingSafeEqual throws on a mismatch, and comparing
  // lengths leaks only the secret's length, which is not sensitive.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    // 404 rather than 401 — an unauthenticated caller should not learn that
    // this endpoint exists at all.
    return new Response('Not found', { status: 404 })
  }

  const started = Date.now()
  const results: Record<string, unknown> = {}

  // Each task is isolated: one failure must not stop the rest, and a partial
  // maintenance run is much better than none.
  try {
    results.sms = await dispatchPending(30)
  } catch (error) {
    results.sms = { error: String(error) }
  }

  try {
    await pruneSessions()
    results.sessions = 'pruned'
  } catch (error) {
    results.sessions = { error: String(error) }
  }

  try {
    await pruneExpiredOtps()
    results.otps = 'pruned'
  } catch (error) {
    results.otps = { error: String(error) }
  }

  try {
    results.rateLimits = await pruneRateLimits()
  } catch (error) {
    results.rateLimits = { error: String(error) }
  }

  try {
    await pruneAbandoned()
    results.carts = 'pruned'
  } catch (error) {
    results.carts = { error: String(error) }
  }

  return Response.json({
    ok: true,
    durationMs: Date.now() - started,
    results,
  })
}
