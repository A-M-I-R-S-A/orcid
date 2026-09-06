import { toPersianDigits } from './persian'

export const CURRENCY_LABEL = 'تومان'

export const MAX_AMOUNT = 100_000_000_000

export function isValidAmount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_AMOUNT
  )
}

export function assertAmount(value: unknown, label = 'amount'): number {
  if (!isValidAmount(value)) {
    throw new Error(`Invalid ${label}: expected a non-negative safe integer of Toman`)
  }
  return value
}

export function formatAmountLatin(amount: number): string {
  return Math.trunc(amount).toLocaleString('en-US')
}

export function formatPrice(amount: number, withLabel = true): string {
  const grouped = toPersianDigits(formatAmountLatin(amount)).replace(/,/g, '٬')
  return withLabel ? `${grouped} ${CURRENCY_LABEL}` : grouped
}

export function effectivePrice(price: number, discountPrice?: number | null): number {
  if (discountPrice != null && discountPrice > 0 && discountPrice < price) {
    return discountPrice
  }
  return price
}

export function hasDiscount(price: number, discountPrice?: number | null): boolean {
  return effectivePrice(price, discountPrice) < price
}

export function discountPercent(price: number, discountPrice?: number | null): number {
  if (!hasDiscount(price, discountPrice) || price <= 0) return 0
  return Math.round(((price - effectivePrice(price, discountPrice)) / price) * 100)
}
