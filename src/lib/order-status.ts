import type { ORDER_STATUSES, PAYMENT_STATUSES } from '@/db/schema/commerce'

export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/**
 * Persian labels live here; the database stores stable English enums. §34 —
 * rewording a label must never require a data migration.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'در انتظار بررسی',
  awaiting_payment: 'در انتظار پرداخت',
  payment_verification: 'در انتظار تأیید پرداخت',
  paid: 'پرداخت شده',
  processing: 'در حال آماده‌سازی',
  shipped: 'ارسال شده',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
  rejected: 'رد شده',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'در انتظار پرداخت',
  reference_submitted: 'در انتظار تأیید پرداخت',
  approved: 'تأیید شده',
  rejected: 'رد شده',
  refunded: 'بازگشت داده شده',
}

/** Drives the status pill colour. Semantic, deliberately not the brand accent. */
export const ORDER_STATUS_TONE: Record<OrderStatus, 'neutral' | 'pending' | 'positive' | 'negative'> = {
  pending: 'pending',
  awaiting_payment: 'pending',
  payment_verification: 'pending',
  paid: 'positive',
  processing: 'neutral',
  shipped: 'neutral',
  delivered: 'positive',
  cancelled: 'negative',
  rejected: 'negative',
}

/* ── The state machine ──────────────────────────────────────────────────── */

/**
 * Transitions an ADMINISTRATOR may perform.
 *
 * Note what is absent: there is no path from any customer-reachable state into
 * `paid` here that a customer could trigger, and `CUSTOMER_TRANSITIONS` below
 * does not contain `paid` at all. §31's guarantee — "customers must never be
 * able to mark their own order as paid" — is enforced by the transition simply
 * not existing, rather than by a hidden button or a UI check.
 */
export const ADMIN_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['payment_verification', 'paid', 'cancelled'],
  payment_verification: ['paid', 'rejected', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  rejected: ['awaiting_payment', 'cancelled'],
}

/**
 * Transitions a CUSTOMER may perform on their own order.
 * Deliberately tiny: submitting a payment reference, and abandoning an unpaid
 * order. Nothing else.
 */
export const CUSTOMER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['cancelled'],
  awaiting_payment: ['payment_verification', 'cancelled'],
  payment_verification: [],
  paid: [],
  processing: [],
  shipped: [],
  delivered: [],
  cancelled: [],
  rejected: ['payment_verification'],
}

export function canAdminTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ADMIN_TRANSITIONS[from].includes(to)
}

export function canCustomerTransition(from: OrderStatus, to: OrderStatus): boolean {
  return CUSTOMER_TRANSITIONS[from].includes(to)
}

/** Statuses in which a customer may still submit or resubmit a payment. */
export function isPayable(status: OrderStatus): boolean {
  return status === 'awaiting_payment' || status === 'rejected'
}

/** Terminal states — no further transition, and stock is never re-reserved. */
export function isTerminal(status: OrderStatus): boolean {
  return status === 'delivered' || status === 'cancelled'
}

/** Cancelling from these states must return stock to the variant. */
export function shouldRestock(from: OrderStatus): boolean {
  return from !== 'cancelled' && from !== 'rejected'
}

/** A review counts as a verified purchase only from a delivered order. */
export function countsAsPurchase(status: OrderStatus): boolean {
  return status === 'delivered'
}
