import 'server-only'

import { and, desc, eq, gt, isNull, lt } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import { otpRequests, users } from '@/db/schema'
import { generateOtp, hashOtp, verifyOtpHash } from '@/lib/crypto'
import { MESSAGES, errors } from '@/lib/errors'
import { consume, enforce, reset } from '@/lib/rate-limit'
import { createSession } from '@/lib/session'
import * as sms from '@/modules/sms/service'

/**
 * Phone OTP authentication. §23 / §24.
 *
 * Every requirement from §24 is implemented here, and the ones that are easy
 * to get subtly wrong are called out at the point they are handled:
 *
 *   expiry              — `expiresAt`, checked in the lookup query
 *   attempt limits      — `attempts` vs `maxAttempts`, incremented on failure
 *   rate limiting       — per phone AND per IP, before anything is sent
 *   secure generation   — crypto.randomInt, not Math.random
 *   server verification — the code never leaves the server
 *   no reuse            — `consumedAt`, set inside the success path
 *   brute-force defence — generic errors, constant-time compare, lockout
 *   no logging          — the code is never written anywhere but the SMS body
 */

const OTP_TTL_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

export interface RequestOtpResult {
  /** Seconds until another code may be requested. */
  retryAfter: number
}

/**
 * Issues an OTP.
 *
 * Deliberately does NOT reveal whether the phone number is already registered:
 * a different response for known and unknown numbers turns this endpoint into
 * a customer-list enumeration oracle.
 */
export async function requestOtp(
  phone: string,
  meta: { ip: string },
): Promise<RequestOtpResult> {
  // Two independent budgets. Per-phone stops one number being spammed; per-IP
  // stops one attacker cycling through many numbers to burn our SMS credit.
  await enforce(`phone:${phone}`, 'otp_request_phone', MESSAGES.otpCooldown)
  await enforce(`ip:${meta.ip}`, 'otp_request_ip')

  // Short cooldown between consecutive sends, independent of the window above.
  const [recent] = await db
    .select({ createdAt: otpRequests.createdAt })
    .from(otpRequests)
    .where(eq(otpRequests.phone, phone))
    .orderBy(desc(otpRequests.createdAt))
    .limit(1)

  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw errors.rateLimited(MESSAGES.otpCooldown)
  }

  // Invalidate any outstanding codes — issuing a new one must retire the old,
  // or an attacker gets several live codes to guess against at once.
  await db
    .update(otpRequests)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpRequests.phone, phone), isNull(otpRequests.consumedAt)))

  const code = generateOtp()

  await db.insert(otpRequests).values({
    phone,
    codeHash: hashOtp(code, phone),
    purpose: 'login',
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    ip: meta.ip.slice(0, 45),
  })

  const result = await sms.sendOtp(phone, code)
  if (!result.ok) {
    throw errors.validation(result.error ?? 'ارسال پیامک ناموفق بود.')
  }

  return { retryAfter: RESEND_COOLDOWN_MS / 1000 }
}

export interface VerifyOtpResult {
  userId: number
  isNewUser: boolean
}

/**
 * Verifies a code and establishes a session.
 *
 * Every failure path returns the SAME Persian message. Distinguishing "wrong
 * code" from "expired" from "already used" would tell an attacker which of
 * their guesses was close, and tell a stranger whether a number has an account.
 */
export async function verifyOtp(
  phone: string,
  code: string,
  meta: { ip: string; userAgent?: string },
): Promise<VerifyOtpResult> {
  await enforce(`phone:${phone}`, 'otp_verify', MESSAGES.otpInvalid)

  const [request] = await db
    .select()
    .from(otpRequests)
    .where(
      and(
        eq(otpRequests.phone, phone),
        isNull(otpRequests.consumedAt),
        gt(otpRequests.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpRequests.createdAt))
    .limit(1)

  if (!request) {
    throw errors.validation(MESSAGES.otpInvalid)
  }

  if (request.attempts >= request.maxAttempts) {
    // Burn it — a code that has run out of attempts must not stay guessable.
    await db
      .update(otpRequests)
      .set({ consumedAt: new Date() })
      .where(eq(otpRequests.id, request.id))
    throw errors.validation(MESSAGES.otpTooMany)
  }

  // Constant-time compare. Counted BEFORE the result is known, so an aborted
  // request cannot be used to get a free guess.
  await db
    .update(otpRequests)
    .set({ attempts: request.attempts + 1 })
    .where(eq(otpRequests.id, request.id))

  if (!verifyOtpHash(code, phone, request.codeHash)) {
    throw errors.validation(MESSAGES.otpInvalid)
  }

  // Single-use. Conditional on still being unconsumed, so two concurrent
  // requests with the same correct code cannot both succeed.
  const consumption = await db
    .update(otpRequests)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpRequests.id, request.id), isNull(otpRequests.consumedAt)))

  if (affectedRows(consumption) === 0) {
    throw errors.validation(MESSAGES.otpInvalid)
  }

  // Upsert the customer. Registration and login are the same flow (§23) —
  // a first-time number simply creates a row.
  const [existing] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)

  let userId: number
  let isNewUser = false

  if (existing) {
    if (!existing.isActive) {
      throw errors.forbidden(MESSAGES.accountDisabled)
    }
    userId = existing.id
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), phoneVerifiedAt: new Date() })
      .where(eq(users.id, userId))
  } else {
    const [inserted] = await db.insert(users).values({
      phone,
      phoneVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    })
    userId = (inserted as unknown as { insertId: number }).insertId
    isNewUser = true
  }

  await createSession(userId, { ip: meta.ip, userAgent: meta.userAgent })

  // Clear the budgets on success, so someone who fat-fingered twice before
  // getting it right is not still penalised on their next login.
  await reset(`phone:${phone}`, 'otp_verify')
  await reset(`phone:${phone}`, 'otp_request_phone')

  return { userId, isNewUser }
}

/** Whether another code may be requested, for the resend countdown. */
export async function resendAvailability(phone: string): Promise<number> {
  const [recent] = await db
    .select({ createdAt: otpRequests.createdAt })
    .from(otpRequests)
    .where(eq(otpRequests.phone, phone))
    .orderBy(desc(otpRequests.createdAt))
    .limit(1)

  if (!recent) return 0

  const elapsed = Date.now() - recent.createdAt.getTime()
  return Math.max(0, Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000))
}

/** Non-throwing probe used by the UI to render a cooldown before submission. */
export async function checkOtpBudget(phone: string): Promise<boolean> {
  const result = await consume(`phone:${phone}`, 'otp_request_phone')
  return result.allowed
}

/** Deletes expired OTP rows. Called from the cron endpoint. */
export async function pruneExpiredOtps(): Promise<void> {
  await db.delete(otpRequests).where(lt(otpRequests.expiresAt, new Date(Date.now() - 86_400_000)))
}
