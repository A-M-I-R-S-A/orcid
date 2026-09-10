'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import * as audit from '@/lib/audit'
import { type ActionResult, errors, fail, ok } from '@/lib/errors'
import { toLatinDigits } from '@/lib/persian'
import { normalizePhone } from '@/lib/persian'
import { clientIp } from '@/lib/rate-limit'
import { requirePermission } from '@/modules/admin/auth'
import * as service from './service'

async function context() {
  const admin = await requirePermission('orders.update_status')
  return { admin, ip: clientIp(await headers()) }
}

function validId(value: number) {
  if (!Number.isInteger(value) || value <= 0) throw errors.validation()
  return value
}

export async function createGetLaterDraftAction(phoneInput: string): Promise<ActionResult<{ cartId: number }>> {
  try {
    const { admin, ip } = await context()
    const phone = normalizePhone(phoneInput)
    if (!phone) throw errors.validation('شماره موبایل معتبر نیست.')
    const cartId = await service.createDraftForAdmin(admin.id, phone)
    await audit.log({ actor: admin, action: 'get_later.update', entityType: 'get_later_cart', entityId: cartId, metadata: { operation: 'create_draft', customerPhone: phone }, ip })
    revalidatePath('/admin/get-later')
    return ok({ cartId })
  } catch (error) {
    return fail(error, { action: 'createGetLaterDraft' })
  }
}

export async function addGetLaterItemAction(input: {
  cartId: number
  sku: string
  quantity: number
}): Promise<ActionResult<void>> {
  try {
    const { admin, ip } = await context()
    const cartId = validId(input.cartId)
    await service.addItem(cartId, input.sku, Number(input.quantity))
    await audit.log({ actor: admin, action: 'get_later.update', entityType: 'get_later_cart', entityId: cartId, metadata: { operation: 'add_item', sku: input.sku, quantity: input.quantity }, ip })
    revalidatePath(`/admin/get-later/${cartId}`)
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'addGetLaterItem', cartId: input.cartId })
  }
}

export async function setGetLaterQuantityAction(input: {
  cartId: number
  itemId: number
  quantity: number
}): Promise<ActionResult<void>> {
  try {
    const { admin, ip } = await context()
    const cartId = validId(input.cartId)
    await service.setItemQuantity(cartId, validId(input.itemId), Number(input.quantity))
    await audit.log({ actor: admin, action: 'get_later.update', entityType: 'get_later_cart', entityId: cartId, metadata: { operation: 'set_quantity', itemId: input.itemId, quantity: input.quantity }, ip })
    revalidatePath(`/admin/get-later/${cartId}`)
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'setGetLaterQuantity', cartId: input.cartId })
  }
}

export async function updateGetLaterDraftAction(input: {
  cartId: number
  adminNote?: string
  expiresAt?: string
}): Promise<ActionResult<void>> {
  try {
    const { admin, ip } = await context()
    const cartId = validId(input.cartId)
    const raw = toLatinDigits(input.expiresAt ?? '').trim()
    const expiresAt = raw ? new Date(raw) : null
    if (expiresAt && Number.isNaN(expiresAt.getTime())) throw errors.validation('تاریخ مهلت معتبر نیست.')
    await service.updateDraft(cartId, { adminNote: input.adminNote, expiresAt })
    await audit.log({ actor: admin, action: 'get_later.update', entityType: 'get_later_cart', entityId: cartId, metadata: { operation: 'details' }, ip })
    revalidatePath(`/admin/get-later/${cartId}`)
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'updateGetLaterDraft', cartId: input.cartId })
  }
}

export async function openGetLaterAction(cartId: number): Promise<ActionResult<void>> {
  try {
    const { admin, ip } = await context()
    validId(cartId)
    await service.openCart(cartId)
    await audit.log({ actor: admin, action: 'get_later.open', entityType: 'get_later_cart', entityId: cartId, ip })
    revalidatePath(`/admin/get-later/${cartId}`)
    revalidatePath('/admin/get-later')
    revalidatePath('/account/get-later')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'openGetLater', cartId })
  }
}

export async function cancelGetLaterAction(cartId: number): Promise<ActionResult<void>> {
  try {
    const { admin, ip } = await context()
    validId(cartId)
    await service.cancelCart(cartId)
    await audit.log({ actor: admin, action: 'get_later.cancel', entityType: 'get_later_cart', entityId: cartId, ip })
    revalidatePath(`/admin/get-later/${cartId}`)
    revalidatePath('/admin/get-later')
    revalidatePath('/account/get-later')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'cancelGetLater', cartId })
  }
}
