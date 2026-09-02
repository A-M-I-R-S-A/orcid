import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ResponsiveImage } from '@/components/media'
import { Alert, OrderStatusBadge, Price } from '@/components/ui'
import { getForUser } from '@/modules/orders/queries'
import { requireUser } from '@/lib/session'
import { isPayable } from '@/lib/order-status'
import { PAYMENT_STATUS_LABELS } from '@/lib/order-status'
import { formatJalaliDateTime } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'

export const metadata = { title: 'جزئیات سفارش' }

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ submitted?: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const { submitted } = await searchParams

  const orderId = Number(id)
  if (!Number.isInteger(orderId) || orderId <= 0) notFound()

  const order = await getForUser(user.id, orderId)
  if (!order) notFound()

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/account/orders" className="text-sm text-accent-2 hover:underline">
            ← سفارش‌های من
          </Link>
          <h1 className="text-2xl md:text-3xl text-ink mt-2 nums">
            سفارش {toPersianDigits(order.orderNumber)}
          </h1>
          <p className="text-sm text-ink-subtle nums mt-1">
            {formatJalaliDateTime(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {submitted === '1' && (
        <Alert tone="positive" title="کد رهگیری ثبت شد">
          پرداخت شما در انتظار بررسی است. پس از تأیید، وضعیت سفارش به‌روزرسانی می‌شود و برای شما
          پیامک ارسال خواهد شد.
        </Alert>
      )}

      {order.payment?.status === 'rejected' && (
        <Alert tone="negative" title="پرداخت تأیید نشد">
          {order.payment.rejectionReason ||
            'کد رهگیری ثبت‌شده تأیید نشد. لطفاً دوباره تلاش کنید.'}
        </Alert>
      )}

      {isPayable(order.status) && (
        <div className="card p-5 flex flex-wrap items-center justify-between gap-4 bg-warning-bg">
          <p className="text-sm text-warning">این سفارش در انتظار پرداخت است.</p>
          <Link href={`/order/${order.id}/pay`} className="btn btn-primary btn-sm">
            پرداخت سفارش
          </Link>
        </div>
      )}

      <section className="card p-6" aria-labelledby="items">
        <h2 id="items" className="text-lg text-ink mb-5">
          اقلام سفارش
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
            <dt className="text-ink-muted">جمع کالاها</dt>
            <dd>
              <Price amount={order.subtotal} size="sm" />
            </dd>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between gap-4 text-success">
              <dt>تخفیف</dt>
              <dd>
                − <Price amount={order.discountTotal} size="sm" />
              </dd>
            </div>
          )}
          {order.shippingTotal > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">هزینه ارسال</dt>
              <dd>
                <Price amount={order.shippingTotal} size="sm" />
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4 pt-3 mt-3 border-t border-line">
            <dt className="font-semibold">مبلغ کل</dt>
            <dd>
              <Price amount={order.grandTotal} />
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        <section className="card p-6" aria-labelledby="shipping">
          <h2 id="shipping" className="text-lg text-ink mb-4">
            نشانی تحویل
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
            <p className="nums">کد پستی: {toPersianDigits(order.shipPostalCode)}</p>
          </address>
          {order.customerNote && (
            <p className="mt-4 pt-4 border-t border-line text-sm text-ink-muted">
              یادداشت شما: {order.customerNote}
            </p>
          )}
        </section>

        <section className="card p-6" aria-labelledby="payment">
          <h2 id="payment" className="text-lg text-ink mb-4">
            وضعیت پرداخت
          </h2>
          <dl className="text-sm space-y-3">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">روش پرداخت</dt>
              <dd>{order.paymentMethod === 'card_to_card' ? 'کارت به کارت' : order.paymentMethod}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">وضعیت</dt>
              <dd>{PAYMENT_STATUS_LABELS[order.paymentStatus]}</dd>
            </div>
            {order.payment?.referenceCode && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">کد رهگیری</dt>
                <dd className="nums" dir="ltr">
                  {order.payment.referenceCode}
                </dd>
              </div>
            )}
            {order.paidAt && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">تاریخ تأیید</dt>
                <dd className="nums">{formatJalaliDateTime(order.paidAt)}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </div>
  )
}
