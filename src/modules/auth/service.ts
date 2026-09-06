import 'server-only'

import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import { otpRequests, users } from '@/db/schema'
import {
  generateOtp,
  hashOtp,
  hashPassword,
  verifyOtpHash,
  verifyPassword,
} from '@/lib/crypto'
import { MESSAGES, errors } from '@/lib/errors'
import { consume, enforce, reset } from '@/lib/rate-limit'
import { createSession, revokeAllUserSessions } from '@/lib/session'
import * as sms from '@/modules/sms/service'

const OTP_TTL_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

export type OtpPurpose = 'login' | 'register' | 'password_reset'

export interface RequestOtpResult {
  retryAfter: number
}

export async function requestOtp(
  phone: string,
  purpose: OtpPurpose,
  meta: { ip: string },
): Promise<RequestOtpResult> {
  await enforce(`phone:${phone}`, 'otp_request_phone', MESSAGES.otpCooldown)
  await enforce(`ip:${meta.ip}`, 'otp_request_ip')

  if (purpose === 'password_reset') {
    await enforce(`phone:${phone}`, 'password_reset')
  }

  const [recent] = await db
    .select({ createdAt: otpRequests.createdAt })
    .from(otpRequests)
    .where(eq(otpRequests.phone, phone))
    .orderBy(desc(otpRequests.createdAt))
    .limit(1)

  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw errors.rateLimited(MESSAGES.otpCooldown)
  }

  await db
    .update(otpRequests)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpRequests.phone, phone), isNull(otpRequests.consumedAt)))

  const code = generateOtp()

  await db.insert(otpRequests).values({
    phone,
    codeHash: hashOtp(code, phone),
    purpose,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    ip: meta.ip.slice(0, 45),
  })

  const result = await sms.sendOtp(phone, code)
  if (!result.ok) {
    throw errors.validation(result.error ?? 'ارسال پیامک ناموفق بود.')
  }

  return { retryAfter: RESEND_COOLDOWN_MS / 1000 }
}

async function consumeOtp(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
  await enforce(`phone:${phone}`, 'otp_verify', MESSAGES.otpInvalid)

  const [request] = await db
    .select()
    .from(otpRequests)
    .where(
      and(
        eq(otpRequests.phone, phone),
        eq(otpRequests.purpose, purpose),
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
    await db
      .update(otpRequests)
      .set({ consumedAt: new Date() })
      .where(eq(otpRequests.id, request.id))
    throw errors.validation(MESSAGES.otpTooMany)
  }

  await db
    .update(otpRequests)
    .set({ attempts: request.attempts + 1 })
    .where(eq(otpRequests.id, request.id))

  if (!verifyOtpHash(code, phone, request.codeHash)) {
    throw errors.validation(MESSAGES.otpInvalid)
  }

  const consumption = await db
    .update(otpRequests)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpRequests.id, request.id), isNull(otpRequests.consumedAt)))

  if (affectedRows(consumption) === 0) {
    throw errors.validation(MESSAGES.otpInvalid)
  }

  await reset(`phone:${phone}`, 'otp_verify')
  await reset(`phone:${phone}`, 'otp_request_phone')
}

export async function register(
  input: { fullName: string; phone: string; password: string },
  meta: { ip: string },
): Promise<RequestOtpResult> {
  const [existing] = await db
    .select({
      id: users.id,
      phoneVerifiedAt: users.phoneVerifiedAt,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.phone, input.phone))
    .limit(1)

  if (existing?.phoneVerifiedAt) {
    return requestOtp(input.phone, 'register', meta)
  }

  const passwordHash = await hashPassword(input.password)

  if (existing) {
    await db
      .update(users)
      .set({
        fullName: input.fullName,
        passwordHash,
        passwordSetAt: new Date(),
        isActive: true,
      })
      .where(eq(users.id, existing.id))
  } else {
    await db.insert(users).values({
      phone: input.phone,
      fullName: input.fullName,
      passwordHash,
      passwordSetAt: new Date(),
    })
  }

  return requestOtp(input.phone, 'register', meta)
}

export interface AuthResult {
  userId: number
  isNewUser: boolean
}

export async function confirmRegistration(
  phone: string,
  code: string,
  meta: { ip: string; userAgent?: string },
): Promise<AuthResult> {
  await consumeOtp(phone, code, 'register')

  const [account] = await db
    .select({
      id: users.id,
      isActive: users.isActive,
      phoneVerifiedAt: users.phoneVerifiedAt,
    })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)

  if (!account) {
    throw errors.validation(MESSAGES.otpInvalid)
  }

  if (!account.isActive) {
    throw errors.forbidden(MESSAGES.accountDisabled)
  }

  if (account.phoneVerifiedAt) {
    throw errors.conflict(MESSAGES.phoneTaken)
  }

  await db
    .update(users)
    .set({ phoneVerifiedAt: new Date(), lastLoginAt: new Date() })
    .where(eq(users.id, account.id))

  await createSession(account.id, { ip: meta.ip, userAgent: meta.userAgent })

  return { userId: account.id, isNewUser: true }
}

export async function signInWithPassword(
  phone: string,
  password: string,
  meta: { ip: string; userAgent?: string },
): Promise<AuthResult> {
  await enforce(`phone:${phone}`, 'login_password_phone', MESSAGES.rateLimited)
  await enforce(`ip:${meta.ip}`, 'login_password_ip')

  const [account] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      phoneVerifiedAt: users.phoneVerifiedAt,
    })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)

  const stored =
    account?.passwordHash ??
    'scrypt:16384:8:1:00000000000000000000000000000000:' + '0'.repeat(128)

  const matches = await verifyPassword(password, stored)

  if (!account || !account.passwordHash || !matches) {
    throw errors.unauthenticated(MESSAGES.credentialsInvalid)
  }

  if (!account.phoneVerifiedAt) {
    throw errors.validation(MESSAGES.phoneUnverified)
  }

  if (!account.isActive) {
    throw errors.forbidden(MESSAGES.accountDisabled)
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, account.id))
  await createSession(account.id, { ip: meta.ip, userAgent: meta.userAgent })

  await reset(`phone:${phone}`, 'login_password_phone')

  return { userId: account.id, isNewUser: false }
}

export async function signInWithOtp(
  phone: string,
  code: string,
  meta: { ip: string; userAgent?: string },
): Promise<AuthResult> {
  await consumeOtp(phone, code, 'login')

  const [account] = await db
    .select({
      id: users.id,
      isActive: users.isActive,
      phoneVerifiedAt: users.phoneVerifiedAt,
    })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)

  if (!account) {
    throw errors.notFound(MESSAGES.accountNotFound)
  }

  if (!account.isActive) {
    throw errors.forbidden(MESSAGES.accountDisabled)
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), phoneVerifiedAt: account.phoneVerifiedAt ?? new Date() })
    .where(eq(users.id, account.id))

  await createSession(account.id, { ip: meta.ip, userAgent: meta.userAgent })

  return { userId: account.id, isNewUser: false }
}

export async function requestPasswordReset(
  phone: string,
  meta: { ip: string },
): Promise<RequestOtpResult> {
  return requestOtp(phone, 'password_reset', meta)
}

export async function resetPassword(
  phone: string,
  code: string,
  password: string,
  meta: { ip: string; userAgent?: string },
): Promise<AuthResult> {
  await consumeOtp(phone, code, 'password_reset')

  const [account] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)

  if (!account) {
    throw errors.notFound(MESSAGES.accountNotFound)
  }

  if (!account.isActive) {
    throw errors.forbidden(MESSAGES.accountDisabled)
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      passwordSetAt: new Date(),
      phoneVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    })
    .where(eq(users.id, account.id))

  await revokeAllUserSessions(account.id)
  await createSession(account.id, { ip: meta.ip, userAgent: meta.userAgent })

  await reset(`phone:${phone}`, 'login_password_phone')

  return { userId: account.id, isNewUser: false }
}

export async function changePassword(
  userId: number,
  input: { currentPassword?: string; password: string },
  meta: { ip: string; userAgent?: string },
): Promise<void> {
  const [account] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!account) throw errors.notFound()

  if (account.passwordHash) {
    if (!input.currentPassword) {
      throw errors.validation(MESSAGES.currentPasswordWrong)
    }
    if (!(await verifyPassword(input.currentPassword, account.passwordHash))) {
      throw errors.validation(MESSAGES.currentPasswordWrong)
    }
    if (await verifyPassword(input.password, account.passwordHash)) {
      throw errors.validation(MESSAGES.passwordSame)
    }
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.password), passwordSetAt: new Date() })
    .where(eq(users.id, userId))

  await revokeAllUserSessions(userId)
  await createSession(userId, { ip: meta.ip, userAgent: meta.userAgent })
}

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

export async function checkOtpBudget(phone: string): Promise<boolean> {
  const result = await consume(`phone:${phone}`, 'otp_request_phone')
  return result.allowed
}

export async function pruneUnverifiedAccounts(olderThanHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 3_600_000)

  const result = await db
    .delete(users)
    .where(
      and(
        isNull(users.phoneVerifiedAt),
        lt(users.createdAt, cutoff),
        sql`NOT EXISTS (SELECT 1 FROM orders WHERE orders.user_id = ${users.id})`,
      ),
    )

  return affectedRows(result)
}

export async function pruneExpiredOtps(): Promise<void> {
  await db.delete(otpRequests).where(lt(otpRequests.expiresAt, new Date(Date.now() - 86_400_000)))
}
