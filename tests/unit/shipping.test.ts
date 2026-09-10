import { describe, expect, it } from 'vitest'

import { calculateShipping } from '@/lib/shipping'

describe('shipping totals', () => {
  it('charges the configured fee below the free-shipping threshold', () => {
    expect(calculateShipping(499_999, { fee: 35_000, freeThreshold: 500_000 })).toBe(35_000)
  })

  it('becomes free at the threshold and never charges an empty cart', () => {
    const config = { fee: 35_000, freeThreshold: 500_000 }
    expect(calculateShipping(500_000, config)).toBe(0)
    expect(calculateShipping(0, config)).toBe(0)
  })

  it('keeps a flat fee when the free threshold is disabled', () => {
    expect(calculateShipping(2_000_000, { fee: 45_000, freeThreshold: 0 })).toBe(45_000)
  })
})
