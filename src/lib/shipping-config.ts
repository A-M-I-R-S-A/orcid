import 'server-only'

import { asc, desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { shippingMethods } from '@/db/schema'
import { getNamespace } from '@/lib/settings'
import type { ShippingConfig } from '@/lib/shipping'

function nonNegativeInteger(value: string | null | undefined): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

export async function getShippingConfig(): Promise<ShippingConfig> {
  try {
    const [method] = await getEnabledShippingMethods()
    if (method) return method
  } catch {
    // The legacy settings preserve existing carts until the shipping migration is applied.
  }
  const settings = await getNamespace('shipping')
  return {
    fee: nonNegativeInteger(settings.shippingFee),
    freeThreshold: nonNegativeInteger(settings.freeShippingThreshold),
  }
}

export interface ShippingMethod extends ShippingConfig {
  id: number
  name: string
  description: string | null
  isDefault: boolean
  isEnabled: boolean
}

function asMethod(row: typeof shippingMethods.$inferSelect): ShippingMethod {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fee: row.fee,
    freeThreshold: row.freeThreshold,
    isDefault: row.isDefault === '1',
    isEnabled: row.isEnabled === '1',
  }
}

export async function getEnabledShippingMethods(): Promise<ShippingMethod[]> {
  const rows = await db
    .select()
    .from(shippingMethods)
    .where(eq(shippingMethods.isEnabled, '1'))
    .orderBy(desc(shippingMethods.isDefault), asc(shippingMethods.sortOrder), asc(shippingMethods.id))
  return rows.map(asMethod)
}

export async function getAllShippingMethods(): Promise<ShippingMethod[]> {
  const rows = await db
    .select()
    .from(shippingMethods)
    .orderBy(desc(shippingMethods.isDefault), asc(shippingMethods.sortOrder), asc(shippingMethods.id))
  return rows.map(asMethod)
}

export async function getDefaultShippingMethod(): Promise<ShippingMethod | null> {
  return (await getEnabledShippingMethods())[0] ?? null
}

export async function resolveShippingMethod(id?: number): Promise<ShippingMethod> {
  const methods = await getEnabledShippingMethods()
  const chosen = id == null ? methods[0] : methods.find((method) => method.id === id)
  if (!chosen) throw new Error('روش ارسال انتخاب‌شده در دسترس نیست.')
  return chosen
}
