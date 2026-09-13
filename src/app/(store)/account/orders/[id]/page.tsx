import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ResponsiveImage } from '@/components/media'
import { GatewayPaymentStatus } from '@/components/gateway-payment-status'
import { Alert, OrderStatusBadge, Price } from '@/components/ui'
import { getForUser } from '@/modules/orders/queries'
import { requireUser } from '@/lib/session'
import { isPayable } from '@/lib/order-status'
import { PAYMENT_STATUS_LABELS } from '@/lib/order-status'
import { formatJalaliDateTime } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'
import { getSiteContent } from '@/lib/site-content'

export async function generateMetadata() { const content = await getSiteContent(); return { title: content.text('order.details') } }

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ submitted?: string; payment?: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const { submitted, payment } = await searchParams

  const orderId = Number(id)
  if (!Number.isInteger(orderId) || orderId <= 0) notFound()

  const order = await getForUser(user.id, orderId)
  if (!order) notFound()
  const content = await getSiteContent()

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/account/orders" className="text-sm text-accent-2 hover:underline">
            ← <SiteStyledText contentKey="order.mine">{content.text('order.mine')}</SiteStyledText>
          </Link>
          <h1 className="text-2xl md:text-3xl text-ink mt-2 nums">
            <SiteStyledText contentKey="order.prefix">{content.text('order.prefix')}</SiteStyledText> {toPersianDigits(order.orderNumber)}
          </h1>
          <p className="text-sm text-ink-subtle nums mt-1">
            {formatJalaliDateTime(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {submitted === '1' && (
        <Alert tone="positive" title={content.text('order.trackingSaved')}>
          <SiteStyledText contentKey="order.trackingPending">{content.text('order.trackingPending')}</SiteStyledText>
        </Alert>
      )}

      {payment === 'verified' && (
        <Alert tone="positive" title={content.text('order.paymentConfirmed')}>
          <SiteStyledText contentKey="order.paymentConfirmedBody">{content.text('order.paymentConfirmedBody')}</SiteStyledText>
        </Alert>
      )}

      {payment === 'pending' && order.paymentStatus !== 'approved' && (
        <Alert tone="negative" title={content.text('order.paymentNotConfirmed')}>
          <SiteStyledText contentKey="order.paymentNotConfirmedBody">{content.text('order.paymentNotConfirmedBody')}</SiteStyledText>
        </Alert>
      )}

      {order.payment?.status === 'rejected' && (
        <Alert tone="negative" title={content.text('order.paymentRejected')}>
          {order.payment.rejectionReason ||
            content.text('order.paymentRejectedBody')}
        </Alert>
      )}

      {isPayable(order.status) && (
        <div className="card p-5 flex flex-wrap items-center justify-between gap-4 bg-warning-bg">
          <p className="text-sm text-warning"><SiteStyledText contentKey="order.awaitingPayment">{content.text('order.awaitingPayment')}</SiteStyledText></p>
          {order.paymentMethod === 'torob_pay' || order.paymentMethod === 'bitpay' ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`/order/${order.id}/pay`} className="btn btn-primary btn-sm">
                <SiteStyledText contentKey="order.continuePayment">{content.text('order.continuePayment')}</SiteStyledText>
              </Link>
              <GatewayPaymentStatus orderId={order.id} />
            </div>
          ) : (
            <Link href={`/order/${order.id}/pay`} className="btn btn-primary btn-sm">
              <SiteStyledText contentKey="order.pay">{content.text('order.pay')}</SiteStyledText>
            </Link>
          )}
        </div>
      )}

      <section className="card p-6" aria-labelledby="items">
        <h2 id="items" className="text-lg text-ink mb-5">
          <SiteStyledText contentKey="order.items">{content.text('order.items')}</SiteStyledText>
        </h2>

        <ul className="space-y-5">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4">
              <Link
                href={`/product/${encodeURIComponent(item.productSlug)}`}
                className="shrink-0 w-20 rounded-lg overflow-hidden bg-surface-sunken"
              >
                <ResponsiveImage
                  path={item.imagePath}
                  alt={item.productName}
                  width={200}
                  height={250}
                  sizes="80px"
                  className="w-full h-auto object-cover aspect-[4/5]"
                />
              </Link>

              <div className="flex-1 min-w-0">
                <Link
                  href={`/product/${encodeURIComponent(item.productSlug)}`}
                  className="font-medium text-ink hover:text-accent-2 transition-colors"
                >
                  {item.productName}
                </Link>
                {item.variantLabel && (
                  <p className="text-sm text-ink-muted mt-1">{item.variantLabel}</p>
                )}
                <p className="text-sm text-ink-subtle mt-1 nums">
                  {toPersianDigits(item.quantity)} × <Price amount={item.unitPrice} size="sm" />
                </p>
              </div>

              <Price amount={item.lineTotal} size="sm" className="shrink-0" />
            </li>
          ))}
        </ul>

        <dl className="mt-6 pt-5 border-t border-line space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted"><SiteStyledText contentKey="order.itemsTotal">{content.text('order.itemsTotal')}</SiteStyledText></dt>
            <dd>
              <Price amount={order.subtotal} size="sm" />
            </dd>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between gap-4 text-success">
              <dt><SiteStyledText contentKey="order.discount">{content.text('order.discount')}</SiteStyledText></dt>
              <dd>
                − <Price amount={order.discountTotal} size="sm" />
              </dd>
            </div>
          )}
          {order.shippingTotal > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted"><SiteStyledText contentKey="order.shippingCost">{content.text('order.shippingCost')}</SiteStyledText></dt>
              <dd>
                <Price amount={order.shippingTotal} size="sm" />
              </dd>
            </div>
          )}
          {order.shippingMethodName && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted"><SiteStyledText contentKey="order.shippingMethod">{content.text('order.shippingMethod')}</SiteStyledText></dt>
              <dd>{order.shippingMethodName}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 pt-3 mt-3 border-t border-line">
            <dt className="font-semibold"><SiteStyledText contentKey="order.total">{content.text('order.total')}</SiteStyledText></dt>
            <dd>
              <Price amount={order.grandTotal} />
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        <section className="card p-6" aria-labelledby="shipping">
          <h2 id="shipping" className="text-lg text-ink mb-4">
            <SiteStyledText contentKey="order.deliveryAddress">{content.text('order.deliveryAddress')}</SiteStyledText>
          </h2>
          <address className="not-italic text-sm text-ink-muted leading-relaxed space-y-1">
            <p className="text-ink">{order.shipFullName}</p>
            <p className="nums" dir="ltr">
              {toPersianDigits(order.shipPhone)}
            </p>
            <p>
              {order.shipProvince}، {order.shipCity}
            </p>
            <p>{order.shipAddressLine}</p>
            <p className="nums"><SiteStyledText contentKey="address.postalCode">{content.text('address.postalCode')}</SiteStyledText>: {toPersianDigits(order.shipPostalCode)}</p>
          </address>
          {order.shipmentTrackingCode && (
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ink-muted"><SiteStyledText contentKey="order.shippingCompany">{content.text('order.shippingCompany')}</SiteStyledText></dt><dd>{order.shipmentCompany || '—'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-muted"><SiteStyledText contentKey="order.shipmentTracking">{content.text('order.shipmentTracking')}</SiteStyledText></dt><dd className="nums" dir="ltr">{order.shipmentTrackingCode}</dd></div>
            </dl>
          )}
          {order.customerNote && (
            <p className="mt-4 pt-4 border-t border-line text-sm text-ink-muted">
              <SiteStyledText contentKey="order.customerNote">{content.text('order.customerNote')}</SiteStyledText>: {order.customerNote}
            </p>
          )}
        </section>

        <section className="card p-6" aria-labelledby="payment">
          <h2 id="payment" className="text-lg text-ink mb-4">
            <SiteStyledText contentKey="order.paymentStatus">{content.text('order.paymentStatus')}</SiteStyledText>
          </h2>
          <dl className="text-sm space-y-3">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted"><SiteStyledText contentKey="order.paymentMethod">{content.text('order.paymentMethod')}</SiteStyledText></dt>
              <dd>
                {order.paymentMethod === 'card_to_card'
                  ? content.text('order.cardToCard')
                  : order.paymentMethod === 'torob_pay'
                    ? content.text('order.torobPay')
                    : order.paymentMethod === 'bitpay'
                      ? content.text('order.bitPay')
                      : order.paymentMethod}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted"><SiteStyledText contentKey="order.status">{content.text('order.status')}</SiteStyledText></dt>
              <dd>{PAYMENT_STATUS_LABELS[order.paymentStatus]}</dd>
            </div>
            {order.payment?.referenceCode && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted"><SiteStyledText contentKey="order.trackingCode">{content.text('order.trackingCode')}</SiteStyledText></dt>
                <dd className="nums" dir="ltr">
                  {order.payment.referenceCode}
                </dd>
              </div>
            )}
            {order.paidAt && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted"><SiteStyledText contentKey="order.confirmedAt">{content.text('order.confirmedAt')}</SiteStyledText></dt>
                <dd className="nums">{formatJalaliDateTime(order.paidAt)}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </div>
  )
}
