'use server'

import { revalidatePath } from 'next/cache'

import { type ActionResult, fail, ok } from '@/lib/errors'
import { requireUser } from '@/lib/session'
import { addressSchema, idSchema, parseOrThrow, profileSchema } from '@/lib/validation'
import * as account from './service'

export async function updateProfileAction(input: {
  fullName: string
  email?: string
}): Promise<ActionResult<void>> {
  try {
    const user = await requireUser()
    const parsed = await parseOrThrow(profileSchema, input)

    await account.updateProfile(user.id, {
      fullName: parsed.fullName,
      email: parsed.email || undefined,
    })

    revalidatePath('/', 'layout')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'updateProfile' })
  }
}

export async function createAddressAction(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: number }>> {
  try {
    const user = await requireUser()
    const parsed = await parseOrThrow(addressSchema, input)

    const id = await account.createAddress(user.id, {
      ...parsed,
      isDefault: input.isDefault === true || input.isDefault === 'on',
    })

    revalidatePath('/account/addresses')
    return ok({ id })
  } catch (error) {
    return fail(error, { action: 'createAddress' })
  }
}

export async function updateAddressAction(
  input: Record<string, unknown>,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser()
    const id = await parseOrThrow(idSchema, input.id)
    const parsed = await parseOrThrow(addressSchema, input)

    await account.updateAddress(user.id, id, {
      ...parsed,
      isDefault: input.isDefault === true || input.isDefault === 'on',
    })

    revalidatePath('/account/addresses')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'updateAddress' })
  }
}

export async function deleteAddressAction(input: {
  id: number
}): Promise<ActionResult<void>> {
  try {
    const user = await requireUser()
    const id = await parseOrThrow(idSchema, input.id)

    await account.deleteAddress(user.id, id)

    revalidatePath('/account/addresses')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'deleteAddress' })
  }
}

export async function setDefaultAddressAction(input: {
  id: number
}): Promise<ActionResult<void>> {
  try {
    const user = await requireUser()
    const id = await parseOrThrow(idSchema, input.id)

    await account.setDefaultAddress(user.id, id)

    revalidatePath('/account/addresses')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'setDefaultAddress' })
  }
}

export async function toggleWishlistAction(input: {
  productId: number
}): Promise<ActionResult<{ saved: boolean; requiresAuth?: boolean }>> {
  try {
    const productId = await parseOrThrow(idSchema, input.productId)

    const { getCurrentUser } = await import('@/lib/session')
    const user = await getCurrentUser()

    if (!user) {
      return ok({ saved: false, requiresAuth: true })
    }

    const result = await account.toggleWishlist(user.id, productId)

    revalidatePath('/account/wishlist')
    return ok(result)
  } catch (error) {
    return fail(error, { action: 'toggleWishlist' })
  }
}
