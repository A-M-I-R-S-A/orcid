'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { type ActionResult, fail, ok } from '@/lib/errors'
import { clientIp } from '@/lib/rate-limit'
import { destroySession, requireUser } from '@/lib/session'
import {
  changePasswordSchema,
  parseOrThrow,
  passwordLoginSchema,
  registerSchema,
  requestOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from '@/lib/validation'
import { mergeGuestCart } from '@/modules/cart/service'
import * as auth from './service'

async function requestMeta() {
  const headerList = await headers()
  return {
    ip: clientIp(headerList),
    userAgent: headerList.get('user-agent') ?? undefined,
  }
}

async function afterSignIn(userId: number) {
  await mergeGuestCart(userId)
  revalidatePath('/', 'layout')
}

export async function registerAction(input: {
  fullName: string
  phone: string
  password: string
}): Promise<ActionResult<{ retryAfter: number }>> {
  try {
    const parsed = await parseOrThrow(registerSchema, input)
    const result = await auth.register(parsed, await requestMeta())
    return ok(result)
  } catch (error) {
    return fail(error, { action: 'register' })
  }
}

export async function confirmRegistrationAction(input: {
  phone: string
  code: string
}): Promise<ActionResult<{ isNewUser: boolean }>> {
  try {
    const parsed = await parseOrThrow(verifyOtpSchema, input)
    const meta = await requestMeta()

    const result = await auth.confirmRegistration(parsed.phone, parsed.code, meta)
    await afterSignIn(result.userId)

    return ok({ isNewUser: result.isNewUser })
  } catch (error) {
    return fail(error, { action: 'confirmRegistration' })
  }
}

export async function passwordLoginAction(input: {
  phone: string
  password: string
}): Promise<ActionResult<{ isNewUser: boolean }>> {
  try {
    const parsed = await parseOrThrow(passwordLoginSchema, input)
    const meta = await requestMeta()

    const result = await auth.signInWithPassword(parsed.phone, parsed.password, meta)
    await afterSignIn(result.userId)

    return ok({ isNewUser: result.isNewUser })
  } catch (error) {
    return fail(error, { action: 'passwordLogin' })
  }
}

export async function requestOtpAction(input: {
  phone: string
  purpose?: 'login' | 'register' | 'password_reset'
}): Promise<ActionResult<{ retryAfter: number }>> {
  try {
    const parsed = await parseOrThrow(requestOtpSchema, input)
    const meta = await requestMeta()

    const result = await auth.requestOtp(parsed.phone, parsed.purpose, { ip: meta.ip })
    return ok(result)
  } catch (error) {
    return fail(error, { action: 'requestOtp' })
  }
}

export async function verifyOtpAction(input: {
  phone: string
  code: string
}): Promise<ActionResult<{ isNewUser: boolean }>> {
  try {
    const parsed = await parseOrThrow(verifyOtpSchema, input)
    const meta = await requestMeta()

    const result = await auth.signInWithOtp(parsed.phone, parsed.code, meta)
    await afterSignIn(result.userId)

    return ok({ isNewUser: result.isNewUser })
  } catch (error) {
    return fail(error, { action: 'verifyOtp' })
  }
}

export async function requestPasswordResetAction(input: {
  phone: string
}): Promise<ActionResult<{ retryAfter: number }>> {
  try {
    const parsed = await parseOrThrow(requestOtpSchema, { ...input, purpose: 'password_reset' })
    const meta = await requestMeta()

    const result = await auth.requestPasswordReset(parsed.phone, { ip: meta.ip })
    return ok(result)
  } catch (error) {
    return fail(error, { action: 'requestPasswordReset' })
  }
}

export async function resetPasswordAction(input: {
  phone: string
  code: string
  password: string
}): Promise<ActionResult<void>> {
  try {
    const parsed = await parseOrThrow(resetPasswordSchema, input)
    const meta = await requestMeta()

    const result = await auth.resetPassword(parsed.phone, parsed.code, parsed.password, meta)
    await afterSignIn(result.userId)

    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'resetPassword' })
  }
}

export async function changePasswordAction(input: {
  currentPassword?: string
  password: string
}): Promise<ActionResult<void>> {
  try {
    const user = await requireUser()
    const parsed = await parseOrThrow(changePasswordSchema, input)
    const meta = await requestMeta()

    await auth.changePassword(
      user.id,
      { currentPassword: parsed.currentPassword || undefined, password: parsed.password },
      meta,
    )

    revalidatePath('/account', 'layout')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'changePassword' })
  }
}

export async function logoutAction(): Promise<ActionResult<void>> {
  try {
    await destroySession()
    revalidatePath('/', 'layout')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'logout' })
  }
}
