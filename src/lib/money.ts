import { toPersianDigits } from './persian'

/**
 * Money.
 *
 * CANONICAL UNIT: Toman. Integer. Always.
 *
 * Every price, discount, subtotal and total in this application is a whole
 * number of Toman held in a BIGINT column and a JS number in memory. There are
 * no floats and no decimals at any layer, because 0.1 + 0.2 !== 0.3 is not a
 * property you want anywhere near an order total.
 *
 * Toman rather than Rial because that is what customers read, what gets typed
 * into a card-to-card transfer, and what the confirmation SMS quotes. Mixing
 * the two units is a 10× bug, so the unit is fixed here and nowhere else.
 * Planning package §D-3.
 */

export const CURRENCY_LABEL = 'تومان'

/** Largest amount we accept anywhere. Guards against overflow and fat fingers. */
export const MAX_AMOUNT = 100_000_000_000

/** Runtime guard for any amount crossing a trust boundary. */
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

/** Thousands separators, Latin digits: 1250000 → "1,250,000" */
export function formatAmountLatin(amount: number): string {
  return Math.trunc(amount).toLocaleString('en-US')
}

/** Customer-facing: 1250000 → "۱٬۲۵۰٬۰۰۰ تومان" */
export function formatPrice(amount: number, withLabel = true): string {
  const grouped = toPersianDigits(formatAmountLatin(amount)).replace(/,/g, '٬')
  return withLabel ? `${grouped} ${CURRENCY_LABEL}` : grouped
}

/**
 * The price a customer actually pays for a variant.
 * A discount only counts when it is set AND strictly below the base price —
 * a "discount" that is higher is a data error, not a price rise.
 */
export function effectivePrice(price: number, discountPrice?: number | null): number {
  if (discountPrice != null && discountPrice > 0 && discountPrice < price) {
    return discountPrice
  }
  return price
}

export function hasDiscount(price: number, discountPrice?: number | null): boolean {
  return effectivePrice(price, discountPrice) < price
}

/** Whole-percent discount, rounded. Returns 0 when there is no discount. */
export function discountPercent(price: number, discountPrice?: number | null): number {
  if (!hasDiscount(price, discountPrice) || price <= 0) return 0
  return Math.round(((price - effectivePrice(price, discountPrice)) / price) * 100)
}
