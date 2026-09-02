'use server'

import { revalidatePath } from 'next/cache'

import { type ActionResult, fail, ok } from '@/lib/errors'
import { getCurrentUser } from '@/lib/session'
import { addToCartSchema, updateCartItemSchema } from '@/lib/validation'
import * as cart from './service'

/**
 * Cart mutations.
 *
 * Server Actions rather than route handlers: Next validates the request origin
 * for these, which gives CSRF protection without a hand-rolled token (§K).
 *
 * Every action re-derives the user from the session cookie. The client never
 * sends a user id, so it cannot act as anyone else.
 */

export async function addToCartAction(input: {
  variantId: number
  quantity?: number
}): Promise<ActionResult<{ count: number }>> {
  try {
    const parsed = addToCartSchema.safeParse(input)
    if (!parsed.success) {
      return fail(new Error('invalid input'))
    }

    const user = await getCurrentUser()
    await cart.addItem(user?.id ?? null, parsed.data.variantId, parsed.data.quantity)

    const count = await cart.cartCount(user?.id ?? null)

    // The header badge lives in the layout, so the whole tree needs to know.
    revalidatePath('/', 'layout')

    return ok({ count })
  } catch (error) {
    return fail(error, { action: 'addToCart', variantId: input.variantId })
  }
}

export async function updateCartItemAction(input: {
  itemId: number
  quantity: number
}): Promise<ActionResult<void>> {
  try {
    const parsed = updateCartItemSchema.safeParse(input)
    if (!parsed.success) return fail(new Error('invalid input'))

    const user = await getCurrentUser()
    await cart.updateQuantity(user?.id ?? null, parsed.data.itemId, parsed.data.quantity)

    revalidatePath('/cart')
    revalidatePath('/', 'layout')

    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'updateCartItem', itemId: input.itemId })
  }
}

export async function removeCartItemAction(itemId: number): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser()
    await cart.removeItem(user?.id ?? null, itemId)

    revalidatePath('/cart')
    revalidatePath('/', 'layout')

    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'removeCartItem', itemId })
  }
}
