'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { type ActionResult, fail, ok } from '@/lib/errors'
import { clientIp } from '@/lib/rate-limit'
import { destroySession } from '@/lib/session'
import { parseOrThrow, requestOtpSchema, verifyOtpSchema } from '@/lib/validation'
import { mergeGuestCart } from '@/modules/cart/service'
import * as auth from './service'

/**
 * Authentication actions.
 *
 * Note what never crosses this boundary: the OTP code exists only inside
 * `service.requestOtp`, is hashed before it touches the database, and is
 * returned to nobody. These actions can report that a code was SENT, never
 * what it was. §24.
 */

export async function requestOtpAction(input: {
  phone: string
}): Promise<ActionResult<{ retryAfter: number }>> {
  try {
    const parsed = await parseOrThrow(requestOtpSchema, input)
    const headerList = await headers()

    const result = await auth.requestOtp(parsed.phone, { ip: clientIp(headerList) })
    return ok(result)
  } catch (error) {
    // No phone number in the log context — it is a personal identifier and
    // this path is high-volume.
    return fail(error, { action: 'requestOtp' })
  }
}

export async function verifyOtpAction(input: {
  phone: string
  code: string
}): Promise<ActionResult<{ isNewUser: boolean }>> {
  try {
    const parsed = await parseOrThrow(verifyOtpSchema, input)
    const headerList = await headers()

    const result = await auth.verifyOtp(parsed.phone, parsed.code, {
      ip: clientIp(headerList),
      userAgent: headerList.get('user-agent') ?? undefined,
    })

    // Anything added as a guest follows the customer into their account.
    await mergeGuestCart(result.userId)

    revalidatePath('/', 'layout')

    return ok({ isNewUser: result.isNewUser })
  } catch (error) {
    return fail(error, { action: 'verifyOtp' })
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
