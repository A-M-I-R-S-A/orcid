import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

import { PaymentReferenceForm } from '@/components/payment-form'
import { Alert, OrderStatusBadge, Price } from '@/components/ui'
import { getForUser } from '@/modules/orders/queries'
import { getProvider } from '@/modules/payments/registry'
import { getCurrentUser } from '@/lib/session'
import { isPayable } from '@/lib/order-status'
import { toPersianDigits } from '@/lib/persian'
import { formatJalaliDateTime } from '@/lib/jalali'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'پرداخت سفارش',
  robots: { index: false, follow: false },
}

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user) redirect(`/login?next=/order/${id}/pay`)

  const orderId = Number(id)
  if (!Number.isInteger(orderId) || orderId <= 0) notFound()

  const order = await getForUser(user.id, orderId)
  if (!order) notFound()

  const provider = getProvider(order.paymentMethod)
  if (!provider) notFound()

  if (!isPayable(order.status)) {
    redirect(`/account/orders/${orderId}`)
  }

  const initiation = await provider.initiate({
    id: order.id,
    orderNumber: order.orderNumber,
    amount: order.grandTotal,
  })

  if (initiation.kind === 'redirect') {
    redirect(initiation.url)
  }

  const { instructions } = initiation
  const wasRejected = order.payment?.status === 'rejected'

  return (
    <div className="container-page py-10 md:py-16">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <p className="eyebrow mb-2">سفارش {toPersianDigits(order.orderNumber)}</p>
          <h1 className="text-3xl text-ink">پرداخت کارت به کارت</h1>
          <div className="mt-4">
            <OrderStatusBadge status={order.status} />
          </div>
        </header>

        {wasRejected && (
          <div className="mb-6">
            <Alert tone="negative" title="پرداخت قبلی تأیید نشد">
              {order.payment?.rejectionReason ||
                'کد رهگیری ثبت‌شده تأیید نشد. لطفاً کد صحیح را دوباره وارد کنید.'}
            </Alert>
          </div>
        )}

        <div className="card p-6 mb-6 text-center bg-surface-sunken">
          <p className="text-sm text-ink-muted mb-2">مبلغ قابل پرداخت</p>
          <p className="text-3xl">
            <Price amount={order.grandTotal} />
          </p>
        </div>

        <section className="card p-6 mb-6" aria-labelledby="bank-details">
          <h2 id="bank-details" className="text-lg text-ink mb-5">
            اطلاعات حساب
          </h2>

          <dl className="space-y-4">
            {instructions.bankName && (
              <div className="flex justify-between gap-4 items-center">
                <dt className="text-sm text-ink-muted">بانک</dt>
                <dd className="font-medium">{instructions.bankName}</dd>
              </div>
            )}

            <div className="flex justify-between gap-4 items-center">
              <dt className="text-sm text-ink-muted">شماره کارت</dt>
              <dd
                dir="ltr"
                className="font-medium nums tracking-wider text-lg select-all"
              >
                {formatCardNumber(instructions.cardNumber)}
              </dd>
            </div>

            {instructions.accountHolder && (
              <div className="flex justify-between gap-4 items-center">
                <dt className="text-sm text-ink-muted">به نام</dt>
                <dd className="font-medium">{instructions.accountHolder}</dd>
              </div>
            )}
          </dl>

          {instructions.note && (
            <p className="mt-6 pt-5 border-t border-line text-sm text-ink-muted leading-relaxed whitespace-pre-line">
              {instructions.note}
            </p>
          )}
        </section>

        <section className="card p-6" aria-labelledby="reference">
          <h2 id="reference" className="text-lg text-ink mb-2">
            ثبت کد رهگیری
          </h2>
          <p className="text-sm text-ink-muted mb-5 leading-relaxed">
            پس از واریز مبلغ، کد رهگیری یا شماره پیگیری تراکنش را وارد کنید. سفارش شما پس از
            بررسی و تأیید توسط تیم ارکید پردازش می‌شود.
          </p>

          <PaymentReferenceForm orderId={order.id} />
        </section>

        <div className="mt-8 text-center">
          <Link href={`/account/orders/${order.id}`} className="text-sm text-accent-2 hover:underline">
            مشاهده جزئیات سفارش
          </Link>
        </div>

        <p className="mt-6 text-xs text-ink-subtle text-center nums">
          ثبت سفارش: {formatJalaliDateTime(order.createdAt)}
        </p>
      </div>
    </div>
  )
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 16) return value
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}
