import type { ORDER_STATUSES, PAYMENT_STATUSES } from '@/db/schema/commerce'

export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

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

export function isPayable(status: OrderStatus): boolean {
  return status === 'awaiting_payment' || status === 'rejected'
}

export function isTerminal(status: OrderStatus): boolean {
  return status === 'delivered' || status === 'cancelled'
}

export function shouldRestock(from: OrderStatus): boolean {
  return from !== 'cancelled' && from !== 'rejected'
}

export const PURCHASE_STATUSES = ['delivered'] as const satisfies readonly OrderStatus[]

export function countsAsPurchase(status: OrderStatus): boolean {
  return (PURCHASE_STATUSES as readonly OrderStatus[]).includes(status)
}
