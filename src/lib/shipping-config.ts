import 'server-only'

import { getNamespace } from '@/lib/settings'
import type { ShippingConfig } from '@/lib/shipping'

function nonNegativeInteger(value: string | null | undefined): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

export async function getShippingConfig(): Promise<ShippingConfig> {
  const settings = await getNamespace('shipping')
  return {
    fee: nonNegativeInteger(settings.shippingFee),
    freeThreshold: nonNegativeInteger(settings.freeShippingThreshold),
  }
}
