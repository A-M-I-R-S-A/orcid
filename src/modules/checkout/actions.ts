'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { type ActionResult, MESSAGES, errors, fail, ok } from '@/lib/errors'
import { clientIp } from '@/lib/rate-limit'
import { requireUser } from '@/lib/session'
import { checkoutSchema, parseOrThrow, paymentReferenceSchema } from '@/lib/validation'
import { resolveCart } from '@/modules/cart/service'
import * as payments from '@/modules/payments/service'
import * as checkout from './service'

/**
 * Checkout and payment submission.
 *
 * Both actions derive the customer from the session. Neither accepts a user
 * id, a price, or an order total from the client — those are computed
 * server-side inside the checkout transaction (§21, §81).
 */

export async function placeOrderAction(input: {
  fullName: string
  phone: string
  province: string
  city: string
  addressLine: string
  postalCode: string
  customerNote?: string
  paymentMethod: string
}): Promise<ActionResult<{ orderId: number; orderNumber: string }>> {
  try {
    const user = await requireUser()
    const parsed = await parseOrThrow(checkoutSchema, input)
    const headerList = await headers()

    const cart = await resolveCart(user.id)
    if (!cart) throw errors.validation(MESSAGES.cartEmpty)

    const result = await checkout.placeOrder(
      user.id,
      cart.id,
      {
        fullName: parsed.fullName,
        phone: parsed.phone,
        province: parsed.province,
        city: parsed.city,
        addressLine: parsed.addressLine,
        postalCode: parsed.postalCode,
        customerNote: parsed.customerNote || undefined,
        paymentMethod: parsed.paymentMethod,
      },
      { ip: clientIp(headerList) },
    )

    // Queued AFTER the transaction commits — a rolled-back order must not
    // leave a queued SMS behind, and a provider outage must not roll back a
    // perfectly good order.
    await checkout.notifyOrderPlaced(result.orderId)

    revalidatePath('/', 'layout')
    revalidatePath('/account/orders')

    return ok({ orderId: result.orderId, orderNumber: result.orderNumber })
  } catch (error) {
    return fail(error, { action: 'placeOrder' })
  }
}

export async function submitPaymentReferenceAction(input: {
  orderId: number
  referenceCode: string
}): Promise<ActionResult<void>> {
  try {
    const user = await requireUser()
    const parsed = await parseOrThrow(paymentReferenceSchema, input)

    await payments.submitReference(user.id, parsed.orderId, parsed.referenceCode)

    revalidatePath(`/account/orders/${parsed.orderId}`)
    revalidatePath('/account/orders')

    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'submitPaymentReference', orderId: input.orderId })
  }
}
