export interface ShippingConfig {
  fee: number
  freeThreshold: number
}

export function calculateShipping(merchandiseTotal: number, config: ShippingConfig): number {
  if (!Number.isSafeInteger(merchandiseTotal) || merchandiseTotal <= 0) return 0
  if (config.freeThreshold > 0 && merchandiseTotal >= config.freeThreshold) return 0
  return config.fee
}
