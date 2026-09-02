import { describe, expect, it } from 'vitest'

import {
  ADMIN_TRANSITIONS,
  CUSTOMER_TRANSITIONS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  canAdminTransition,
  canCustomerTransition,
  countsAsPurchase,
  isPayable,
  isTerminal,
  shouldRestock,
} from '@/lib/order-status'
import { ORDER_STATUSES } from '@/db/schema/commerce'

/**
 * The order state machine.
 *
 * These tests exist mainly to protect ONE guarantee: §31's "customers must
 * never be able to mark their own order as paid". That guarantee is structural
 * — the transition simply does not exist — and this suite is what stops a
 * future edit from quietly adding it.
 */

describe('§31 — customers cannot reach a paid state', () => {
  it('has no customer transition into paid', () => {
    for (const from of ORDER_STATUSES) {
      expect(
        CUSTOMER_TRANSITIONS[from],
        `customer must not be able to go ${from} → paid`,
      ).not.toContain('paid')
    }
  })

  it('has no customer transition into any post-payment state', () => {
    const postPayment = ['paid', 'processing', 'shipped', 'delivered'] as const

    for (const from of ORDER_STATUSES) {
      for (const to of postPayment) {
        expect(
          canCustomerTransition(from, to),
          `customer must not be able to go ${from} → ${to}`,
        ).toBe(false)
      }
    }
  })

  it('lets a customer reach only payment_verification and cancelled', () => {
    const reachable = new Set(Object.values(CUSTOMER_TRANSITIONS).flat())
    expect([...reachable].sort()).toEqual(['cancelled', 'payment_verification'])
  })
})

describe('admin transitions', () => {
  it('allows the documented happy path end to end', () => {
    const path = [
      ['awaiting_payment', 'payment_verification'],
      ['payment_verification', 'paid'],
      ['paid', 'processing'],
      ['processing', 'shipped'],
      ['shipped', 'delivered'],
    ] as const

    for (const [from, to] of path) {
      expect(canAdminTransition(from, to), `${from} → ${to}`).toBe(true)
    }
  })

  it('refuses to skip the payment step', () => {
    expect(canAdminTransition('awaiting_payment', 'shipped')).toBe(false)
    expect(canAdminTransition('awaiting_payment', 'delivered')).toBe(false)
  })

  it('refuses to move backwards from a terminal state', () => {
    expect(ADMIN_TRANSITIONS.delivered).toHaveLength(0)
    expect(ADMIN_TRANSITIONS.cancelled).toHaveLength(0)
  })

  it('lets a rejected payment return to awaiting_payment so the customer can retry', () => {
    expect(canAdminTransition('rejected', 'awaiting_payment')).toBe(true)
  })

  it('never transitions to itself', () => {
    for (const status of ORDER_STATUSES) {
      expect(ADMIN_TRANSITIONS[status]).not.toContain(status)
    }
  })
})

describe('helpers', () => {
  it('treats only awaiting_payment and rejected as payable', () => {
    const payable = ORDER_STATUSES.filter(isPayable)
    expect(payable.sort()).toEqual(['awaiting_payment', 'rejected'])
  })

  it('treats delivered and cancelled as terminal', () => {
    expect(ORDER_STATUSES.filter(isTerminal).sort()).toEqual(['cancelled', 'delivered'])
  })

  it('restocks on cancel except from states that never held stock', () => {
    expect(shouldRestock('paid')).toBe(true)
    expect(shouldRestock('processing')).toBe(true)
    // Already cancelled or rejected — restocking again would double-count.
    expect(shouldRestock('cancelled')).toBe(false)
    expect(shouldRestock('rejected')).toBe(false)
  })

  it('counts only a delivered order as a verified purchase', () => {
    expect(ORDER_STATUSES.filter(countsAsPurchase)).toEqual(['delivered'])
  })
})

describe('labels', () => {
  it('has a Persian label for every status', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[status], status).toBeTruthy()
      // Must contain Persian characters, not be an untranslated English string.
      expect(ORDER_STATUS_LABELS[status]).toMatch(/[؀-ۿ]/)
    }
  })

  it('has a tone for every status', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_TONE[status], status).toBeTruthy()
    }
  })

  it('gives cancelled and rejected a negative tone', () => {
    expect(ORDER_STATUS_TONE.cancelled).toBe('negative')
    expect(ORDER_STATUS_TONE.rejected).toBe('negative')
  })
})
