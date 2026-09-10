'use server'

import { revalidatePath } from 'next/cache'

import { type ActionResult, errors, fail, ok, reportError } from '@/lib/errors'
import { requireUser } from '@/lib/session'
import { notifyOrderPlaced } from '@/modules/checkout/service'
import { addForUser, submitForUser, type GetLaterDecision } from './service'

export async function addToGetLaterAction(input: { variantId: number; quantity: number }): Promise<ActionResult<{ cartId: number }>> {
  try {
    const user = await requireUser()
    const cartId = await addForUser(user.id, Number(input.variantId), Number(input.quantity))
    revalidatePath('/account/get-later')
    revalidatePath('/', 'layout')
    return ok({ cartId })
  } catch (error) {
    return fail(error, { action: 'addToGetLater', variantId: input.variantId })
  }
}

export async function submitGetLaterAction(input: {
  cartId: number
  addressId: number
  paymentMethod: string
  customerNote?: string
  decisions: { itemId: number; decision: GetLaterDecision }[]
}): Promise<ActionResult<{ orderId: number | null }>> {
  try {
    const user = await requireUser()
    if (!Number.isInteger(input.cartId) || input.cartId <= 0) throw errors.validation()
    if (input.customerNote && input.customerNote.trim().length > 500) {
      throw errors.validation('یادداشت شما بیش از حد طولانی است.')
    }
    if (!Array.isArray(input.decisions) || input.decisions.length > 100) {
      throw errors.validation()
    }
    const allReturning =
      input.decisions.length > 0 && input.decisions.every((item) => item.decision === 'return')
    if (!allReturning && (!Number.isInteger(input.addressId) || input.addressId <= 0)) {
      throw errors.validation('یک نشانی معتبر انتخاب کنید.')
    }
    for (const item of input.decisions) {
      if (!Number.isInteger(item.itemId) || item.itemId <= 0 || !['pay', 'return'].includes(item.decision)) {
        throw errors.validation('انتخاب کالا معتبر نیست.')
      }
    }

    const result = await submitForUser({ ...input, userId: user.id })
    if (result.orderId) {
      try {
        await notifyOrderPlaced(result.orderId)
      } catch (error) {
        reportError(error, { action: 'notifyGetLaterOrderPlaced', orderId: result.orderId })
      }
    }

    revalidatePath('/account/get-later')
    revalidatePath('/account/orders')
    revalidatePath('/', 'layout')
    return ok(result)
  } catch (error) {
    return fail(error, { action: 'submitGetLater', cartId: input.cartId })
  }
}
