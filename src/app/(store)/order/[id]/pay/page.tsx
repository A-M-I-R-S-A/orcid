import { SiteStyledText } from '@/components/site-content-provider'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

import { PaymentReferenceForm } from '@/components/payment-form'
import { GatewayPaymentButton } from '@/components/gateway-payment-button'
import { Alert, OrderStatusBadge, Price } from '@/components/ui'
import { getForUser } from '@/modules/orders/queries'
import { getProvider } from '@/modules/payments/registry'
import { getCurrentUser } from '@/lib/session'
import { isPayable } from '@/lib/order-status'
import { toPersianDigits } from '@/lib/persian'
import { formatJalaliDateTime } from '@/lib/jalali'
import { getSiteContent } from '@/lib/site-content'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const content = await getSiteContent()
  return {
  title: content.text('order.pay'),
  robots: { index: false, follow: false },
  }
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
  const content = await getSiteContent()

  if (!isPayable(order.status)) {
    redirect(`/account/orders/${orderId}`)
  }

  const wasRejected = order.payment?.status === 'rejected'

  if (provider.info.kind === 'gateway') {
    return (
      <div className="container-page py-10 md:py-16">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <p className="eyebrow mb-2"><SiteStyledText contentKey="order.prefix">{content.text('order.prefix')}</SiteStyledText> {toPersianDigits(order.orderNumber)}</p>
            <h1 className="text-3xl text-ink">{provider.info.label}</h1>
            <p className="mt-3 text-sm text-ink-muted leading-relaxed">
              {provider.info.description}
            </p>
          </header>

          <div className="card p-6 mb-6 text-center bg-surface-sunken">
            <p className="text-sm text-ink-muted mb-2"><SiteStyledText contentKey="order.amountDue">{content.text('order.amountDue')}</SiteStyledText></p>
            <p className="text-3xl">
              <Price amount={order.grandTotal} />
            </p>
          </div>

          <section className="card p-6 space-y-5">
            <p className="text-sm text-ink-muted leading-relaxed">
              <SiteStyledText contentKey="order.gatewayNotice">{content.text('order.gatewayNotice')}</SiteStyledText>
            </p>
            <GatewayPaymentButton orderId={order.id} label={`ادامه و ${provider.info.label}`} />
          </section>

          <div className="mt-8 text-center">
            <Link href={`/account/orders/${order.id}`} className="text-sm text-accent-2 hover:underline">
              <SiteStyledText contentKey="order.backDetails">{content.text('order.backDetails')}</SiteStyledText>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const initiation = await provider.initiate({
    id: order.id,
    orderNumber: order.orderNumber,
    amount: order.grandTotal,
  })
  if (initiation.kind !== 'instructions') notFound()
  const { instructions } = initiation

  return (
    <div className="container-page py-10 md:py-16">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <p className="eyebrow mb-2"><SiteStyledText contentKey="order.prefix">{content.text('order.prefix')}</SiteStyledText> {toPersianDigits(order.orderNumber)}</p>
          <h1 className="text-3xl text-ink"><SiteStyledText contentKey="order.cardToCard">{content.text('order.cardToCard')}</SiteStyledText></h1>
          <div className="mt-4">
            <OrderStatusBadge status={order.status} />
          </div>
        </header>

        {wasRejected && (
          <div className="mb-6">
            <Alert tone="negative" title={content.text('order.previousRejected')}>
              {order.payment?.rejectionReason ||
                content.text('order.invalidTracking')}
            </Alert>
          </div>
        )}

        <div className="card p-6 mb-6 text-center bg-surface-sunken">
          <p className="text-sm text-ink-muted mb-2"><SiteStyledText contentKey="order.amountDue">{content.text('order.amountDue')}</SiteStyledText></p>
          <p className="text-3xl">
            <Price amount={order.grandTotal} />
          </p>
        </div>

        <section className="card p-6 mb-6" aria-labelledby="bank-details">
          <h2 id="bank-details" className="text-lg text-ink mb-5">
            <SiteStyledText contentKey="order.accountInfo">{content.text('order.accountInfo')}</SiteStyledText>
          </h2>

          <dl className="space-y-4">
            {instructions.bankName && (
              <div className="flex justify-between gap-4 items-center">
                <dt className="text-sm text-ink-muted"><SiteStyledText contentKey="order.bank">{content.text('order.bank')}</SiteStyledText></dt>
                <dd className="font-medium">{instructions.bankName}</dd>
              </div>
            )}

            <div className="flex justify-between gap-4 items-center">
              <dt className="text-sm text-ink-muted"><SiteStyledText contentKey="order.cardNumber">{content.text('order.cardNumber')}</SiteStyledText></dt>
              <dd
                dir="ltr"
                className="font-medium nums tracking-wider text-lg select-all"
              >
                {formatCardNumber(instructions.cardNumber)}
              </dd>
            </div>

            {instructions.accountHolder && (
              <div className="flex justify-between gap-4 items-center">
                <dt className="text-sm text-ink-muted"><SiteStyledText contentKey="order.accountHolder">{content.text('order.accountHolder')}</SiteStyledText></dt>
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
            <SiteStyledText contentKey="order.submitTracking">{content.text('order.submitTracking')}</SiteStyledText>
          </h2>
          <p className="text-sm text-ink-muted mb-5 leading-relaxed">
            <SiteStyledText contentKey="order.trackingInstructions">{content.text('order.trackingInstructions')}</SiteStyledText>
          </p>

          <PaymentReferenceForm orderId={order.id} />
        </section>

        <div className="mt-8 text-center">
          <Link href={`/account/orders/${order.id}`} className="text-sm text-accent-2 hover:underline">
            <SiteStyledText contentKey="order.viewDetails">{content.text('order.viewDetails')}</SiteStyledText>
          </Link>
        </div>

        <p className="mt-6 text-xs text-ink-subtle text-center nums">
          <SiteStyledText contentKey="order.createdAt">{content.text('order.createdAt')}</SiteStyledText>: {formatJalaliDateTime(order.createdAt)}
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
