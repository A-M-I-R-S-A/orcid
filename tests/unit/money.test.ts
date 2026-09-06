import { describe, expect, it } from 'vitest'

import {
  CURRENCY_LABEL,
  MAX_AMOUNT,
  assertAmount,
  discountPercent,
  effectivePrice,
  formatAmountLatin,
  formatPrice,
  hasDiscount,
  isValidAmount,
} from '@/lib/money'

describe('effectivePrice', () => {
  it('returns the base price when there is no discount', () => {
    expect(effectivePrice(100_000, null)).toBe(100_000)
    expect(effectivePrice(100_000, undefined)).toBe(100_000)
  })

  it('returns the discount when it is genuinely lower', () => {
    expect(effectivePrice(100_000, 80_000)).toBe(80_000)
  })

  it('ignores a discount that is not lower — that is a data error, not a price rise', () => {
    expect(effectivePrice(100_000, 100_000)).toBe(100_000)
    expect(effectivePrice(100_000, 120_000)).toBe(100_000)
  })

  it('ignores a zero discount', () => {
    expect(effectivePrice(100_000, 0)).toBe(100_000)
  })
})

describe('hasDiscount', () => {
  it('is true only when the customer actually pays less', () => {
    expect(hasDiscount(100_000, 80_000)).toBe(true)
    expect(hasDiscount(100_000, 100_000)).toBe(false)
    expect(hasDiscount(100_000, null)).toBe(false)
  })
})

describe('discountPercent', () => {
  it('computes a whole percentage', () => {
    expect(discountPercent(100_000, 80_000)).toBe(20)
    expect(discountPercent(200_000, 150_000)).toBe(25)
  })

  it('rounds rather than truncating', () => {
    expect(discountPercent(300_000, 199_000)).toBe(34)
  })

  it('returns zero when there is no discount', () => {
    expect(discountPercent(100_000, null)).toBe(0)
    expect(discountPercent(0, 0)).toBe(0)
  })
})

describe('isValidAmount', () => {
  it('accepts non-negative safe integers within the ceiling', () => {
    expect(isValidAmount(0)).toBe(true)
    expect(isValidAmount(1_250_000)).toBe(true)
    expect(isValidAmount(MAX_AMOUNT)).toBe(true)
  })

  it('rejects anything that is not a whole, non-negative number', () => {
    expect(isValidAmount(-1)).toBe(false)
    expect(isValidAmount(1000.5)).toBe(false)
    expect(isValidAmount(MAX_AMOUNT + 1)).toBe(false)
    expect(isValidAmount(Number.NaN)).toBe(false)
    expect(isValidAmount(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isValidAmount('1000')).toBe(false)
    expect(isValidAmount(null)).toBe(false)
    expect(isValidAmount(undefined)).toBe(false)
  })
})

describe('assertAmount', () => {
  it('returns the value when valid', () => {
    expect(assertAmount(500)).toBe(500)
  })

  it('throws on an invalid amount rather than coercing it', () => {
    expect(() => assertAmount(-5)).toThrow()
    expect(() => assertAmount(1.5)).toThrow()
  })
})

describe('formatting', () => {
  it('groups Latin digits in thousands', () => {
    expect(formatAmountLatin(1_250_000)).toBe('1,250,000')
  })

  it('renders Persian digits with the currency label', () => {
    const formatted = formatPrice(1_250_000)
    expect(formatted).toContain(CURRENCY_LABEL)
    expect(formatted).toMatch(/[۰-۹]/)
    expect(formatted).not.toMatch(/[0-9]/)
  })

  it('omits the label when asked', () => {
    expect(formatPrice(1000, false)).not.toContain(CURRENCY_LABEL)
  })

  it('formats zero without breaking', () => {
    expect(formatPrice(0, false)).toBe('۰')
  })
})
