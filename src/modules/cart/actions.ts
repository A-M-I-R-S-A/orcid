'use server'

import { revalidatePath } from 'next/cache'

import { type ActionResult, fail, ok } from '@/lib/errors'
import { getCurrentUser } from '@/lib/session'
import { addToCartSchema, updateCartItemSchema } from '@/lib/validation'
import * as cart from './service'

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
