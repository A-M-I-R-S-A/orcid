import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge, PageHeader, Table, TableWrap, Td, Th } from '@/components/admin/ui'
import { OrderStatusControl, OrderNoteForm } from '@/components/admin/order-controls'
import { PaymentReviewActions } from '@/components/admin/payment-actions'
import { getForAdmin } from '@/modules/orders/queries'
import { requirePermission } from '@/modules/admin/auth'
import { hasPermission } from '@/lib/permissions'
import {
  ADMIN_TRANSITIONS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABELS,
} from '@/lib/order-status'
import { formatPrice } from '@/lib/money'
import { formatJalaliDateTime } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'جزئیات سفارش' }

const SMS_STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار تأیید',
  approved: 'تأیید شده — در صف ارسال',
  sending: 'در حال ارسال',
  sent: 'ارسال شده',
  failed: 'ناموفق',
  cancelled: 'لغو شده',
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const admin = await requirePermission('orders.view')
  const { id } = await params

  const orderId = Number(id)
  if (!Number.isInteger(orderId) || orderId <= 0) notFound()

  const order = await getForAdmin(orderId)
  if (!order) notFound()

  const canUpdateStatus = hasPermission(admin, 'orders.update_status')
  const canNote = hasPermission(admin, 'orders.note')
  const canApprove = hasPermission(admin, 'payments.approve')
  const canReject = hasPermission(admin, 'payments.reject')

  const nextStatuses = ADMIN_TRANSITIONS[order.status]

  return (
    <>
      <div className="mb-2">
        <Link href="/admin/orders" className="text-sm text-accent-2 hover:underline">
          ← سفارش‌ها
        </Link>
      </div>

      <PageHeader
        title={`سفارش ${toPersianDigits(order.orderNumber)}`}
        description={formatJalaliDateTime(order.createdAt)}
        action={<Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>}
      />

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <section className="card overflow-hidden">
            <h2 className="text-sm text-ink-muted px-4 py-3 bg-surface-sunken">اقلام سفارش</h2>
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>محصول</Th>
                    <Th>کد کالا</Th>
                    <Th>قیمت واحد</Th>
                    <Th>تعداد</Th>
                    <Th>جمع</Th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <Td>
                        <Link
                          href={`/product/${encodeURIComponent(item.productSlug)}`}
                          target="_blank"
                          rel="noopener"
                          className="text-accent-2 hover:underline"
                        >
                          {item.productName}
                        </Link>
                        {item.variantLabel && (
                          <span className="block text-xs text-ink-subtle mt-0.5">
                            {item.variantLabel}
                          </span>
                        )}
                      </Td>
                      <Td className="text-xs nums" >
                        <span dir="ltr">{item.sku}</span>
                      </Td>
                      <Td className="nums whitespace-nowrap">{formatPrice(item.unitPrice, false)}</Td>
                      <Td className="nums">{toPersianDigits(item.quantity)}</Td>
                      <Td className="nums whitespace-nowrap">{formatPrice(item.lineTotal, false)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <dl className="p-4 space-y-2 text-sm border-t border-line">
              <div className="flex justify-between">
                <dt className="text-ink-muted">جمع کالاها</dt>
                <dd className="nums">{formatPrice(order.subtotal)}</dd>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between text-success">
                  <dt>تخفیف</dt>
                  <dd className="nums">− {formatPrice(order.discountTotal)}</dd>
                </div>
              )}
              {order.shippingTotal > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-muted">هزینه ارسال</dt>
                  <dd className="nums">{formatPrice(order.shippingTotal)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-2 mt-2 border-t border-line font-semibold">
                <dt>مبلغ کل</dt>
                <dd className="nums">{formatPrice(order.grandTotal)}</dd>
              </div>
            </dl>
          </section>

          {/* Payment */}
          <section className="card p-5">
            <h2 className="text-sm text-ink-muted mb-4">پرداخت</h2>

            {order.payment ? (
              <>
                <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-ink-muted mb-1">وضعیت</dt>
                    <dd>{PAYMENT_STATUS_LABELS[order.payment.status]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted mb-1">روش</dt>
                    <dd>
                      {order.payment.method === 'card_to_card' ? 'کارت به کارت' : order.payment.method}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted mb-1">کد رهگیری</dt>
                    <dd className="nums font-medium select-all" dir="ltr">
                      {order.payment.referenceCode ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted mb-1">زمان ثبت</dt>
                    <dd className="nums text-xs">
                      {order.payment.referenceSubmittedAt
                        ? formatJalaliDateTime(order.payment.referenceSubmittedAt)
                        : '—'}
                    </dd>
                  </div>
                </dl>

                {order.payment.adminNote && (
                  <p className="mt-4 pt-4 border-t border-line text-sm text-ink-muted">
                    یادداشت بررسی: {order.payment.adminNote}
                  </p>
                )}

                {order.payment.status === 'reference_submitted' && (canApprove || canReject) && (
                  <div className="mt-5 pt-4 border-t border-line">
                    <PaymentReviewActions
                      paymentId={order.payment.id}
                      canApprove={canApprove}
                      canReject={canReject}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-subtle">پرداختی ثبت نشده است.</p>
            )}
          </section>

          {/* SMS state — §44 requires the operator to be able to see it. */}
          {order.smsMessages.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="text-sm text-ink-muted px-4 py-3 bg-surface-sunken">
                پیامک‌های این سفارش
              </h2>
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th>رویداد</Th>
                      <Th>وضعیت</Th>
                      <Th>تلاش</Th>
                      <Th>زمان ارسال</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.smsMessages as Record<string, unknown>[]).map((message) => (
                      <tr key={String(message.id)}>
                        <Td className="text-xs">{String(message.event)}</Td>
                        <Td>
                          <Badge
                            tone={
                              message.status === 'sent'
                                ? 'positive'
                                : message.status === 'failed'
                                  ? 'negative'
                                  : 'pending'
                            }
                          >
                            {SMS_STATUS_LABELS[String(message.status)] ?? String(message.status)}
                          </Badge>
                        </Td>
                        <Td className="nums text-xs">{toPersianDigits(Number(message.attempts))}</Td>
                        <Td className="text-xs nums">
                          {message.sent_at
                            ? formatJalaliDateTime(String(message.sent_at))
                            : '—'}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {canUpdateStatus && nextStatuses.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm text-ink-muted mb-3">تغییر وضعیت</h2>
              <OrderStatusControl
                orderId={order.id}
                current={order.status}
                options={nextStatuses.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))}
              />
            </section>
          )}

          <section className="card p-5">
            <h2 className="text-sm text-ink-muted mb-3">مشتری</h2>
            <p className="text-ink font-medium">{order.customer.name || order.shipFullName}</p>
            <p className="text-sm text-ink-muted nums mt-1" dir="ltr">
              {order.customer.phone}
            </p>
            <Link
              href={`/admin/customers?q=${encodeURIComponent(order.customer.phone)}`}
              className="text-xs text-accent-2 hover:underline mt-3 inline-block"
            >
              مشاهده پروفایل مشتری
            </Link>
          </section>

          <section className="card p-5">
            <h2 className="text-sm text-ink-muted mb-3">نشانی تحویل</h2>
            <address className="not-italic text-sm text-ink-muted leading-relaxed space-y-1">
              <p className="text-ink">{order.shipFullName}</p>
              <p className="nums" dir="ltr">
                {order.shipPhone}
              </p>
              <p>
                {order.shipProvince}، {order.shipCity}
              </p>
              <p>{order.shipAddressLine}</p>
              <p className="nums">کد پستی: {toPersianDigits(order.shipPostalCode)}</p>
            </address>
            {order.customerNote && (
              <p className="mt-3 pt-3 border-t border-line text-sm text-ink-muted">
                یادداشت مشتری: {order.customerNote}
              </p>
            )}
          </section>

          {canNote && (
            <section className="card p-5">
              <h2 className="text-sm text-ink-muted mb-3">یادداشت داخلی</h2>
              <p className="text-xs text-ink-subtle mb-3">
                این یادداشت هرگز به مشتری نمایش داده نمی‌شود.
              </p>
              <OrderNoteForm orderId={order.id} current={order.internalNote ?? ''} />
            </section>
          )}
        </div>
      </div>
    </>
  )
}
