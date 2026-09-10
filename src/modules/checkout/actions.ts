'use server'

import { revalidatePath } from 'next/cache'

import { type ActionResult, MESSAGES, errors, fail, ok, reportError } from '@/lib/errors'
import { requireUser } from '@/lib/session'
import { checkoutSchema, parseOrThrow, paymentReferenceSchema } from '@/lib/validation'
import { getCart } from '@/modules/cart/service'
import * as payments from '@/modules/payments/service'
import { assertTorobEligible } from '@/modules/payments/gateway-client'
import { checkGatewayPaymentForUser } from '@/modules/payments/gateway-service'
import { getProvider } from '@/modules/payments/registry'
import { getForUser } from '@/modules/orders/queries'
import * as checkout from './service'

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

    const cart = await getCart(user.id)
    if (!cart.id || cart.lines.length === 0) throw errors.validation(MESSAGES.cartEmpty)

    if (parsed.paymentMethod === 'torob_pay') {
      await assertTorobEligible(cart.grandTotal)
    }

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
      cart.grandTotal,
    )

    try {
      await checkout.notifyOrderPlaced(result.orderId)
    } catch (error) {
      reportError(error, { action: 'notifyOrderPlaced', orderId: result.orderId })
    }

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

export async function checkGatewayPaymentAction(input: {
  orderId: number
}): Promise<ActionResult<{ paid: boolean }>> {
  try {
    const user = await requireUser()
    const orderId = Number(input.orderId)
    if (!Number.isInteger(orderId) || orderId <= 0) throw errors.validation()

    const result = await checkGatewayPaymentForUser(orderId, user.id)
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath('/account/orders')
    return ok(result)
  } catch (error) {
    return fail(error, { action: 'checkGatewayPayment', orderId: input.orderId })
  }
}

export async function startGatewayPaymentAction(input: {
  orderId: number
}): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    const user = await requireUser()
    const orderId = Number(input.orderId)
    if (!Number.isInteger(orderId) || orderId <= 0) throw errors.validation()

    const order = await getForUser(user.id, orderId)
    if (!order) throw errors.notFound()
    const provider = getProvider(order.paymentMethod)
    if (!provider || provider.info.kind !== 'gateway') {
      throw errors.payment(MESSAGES.paymentMethodUnavailable)
    }

    const result = await provider.initiate({
      id: order.id,
      orderNumber: order.orderNumber,
      amount: order.grandTotal,
    })
    if (result.kind !== 'redirect') throw errors.payment(MESSAGES.paymentMethodUnavailable)
    return ok({ redirectUrl: result.url })
  } catch (error) {
    return fail(error, { action: 'startGatewayPayment', orderId: input.orderId })
  }
}
