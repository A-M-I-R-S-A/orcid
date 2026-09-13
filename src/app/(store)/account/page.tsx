import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'

import { EmptyState, OrderStatusBadge, Price } from '@/components/ui'
import { listForUser } from '@/modules/orders/queries'
import { addressCount, wishlistCount } from '@/modules/account/service'
import { requireUser } from '@/lib/session'
import { formatJalali } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'
import { activeCountForUser, getConfig as getLaterConfig } from '@/modules/get-later/service'
import { getSiteContent } from '@/lib/site-content'

export async function generateMetadata() { const content = await getSiteContent(); return { title: content.text('account.nav.dashboard') } }

export default async function AccountPage() {
  const user = await requireUser()

  const [orders, wishlist, addresses, getLater, getLaterSettings, content] = await Promise.all([
    listForUser(user.id, 4),
    wishlistCount(user.id),
    addressCount(user.id),
    activeCountForUser(user.id),
    getLaterConfig(),
    getSiteContent(),
  ])

  const awaiting = orders.filter(
    (o) => o.status === 'awaiting_payment' || o.status === 'payment_verification',
  ).length

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow mb-3"><SiteStyledText contentKey="account.eyebrow">{content.text('account.eyebrow')}</SiteStyledText></p>
        <h1 className="section-title">
          {user.fullName ? `${content.text('account.hello')} ${user.fullName.split(' ')[0]}` : content.text('account.nav.dashboard')}
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Tile
          href="/account/orders"
          label={content.text('account.nav.orders')}
          value={orders.length}
          hint={awaiting > 0 ? `${toPersianDigits(awaiting)} ${content.text('account.awaitingPayment')}` : undefined}
          tone={awaiting > 0 ? 'attention' : 'plain'}
        />
        {(getLaterSettings.enabled || getLater > 0) && (
          <Tile
            href="/account/get-later"
            label={content.text('account.payLater')}
            value={getLater}
            hint={getLater > 0 ? content.text('account.waitingDecision') : content.text('account.noActiveCart')}
            tone={getLater > 0 ? 'attention' : 'plain'}
          />
        )}
        <Tile href="/account/wishlist" label={content.text('account.nav.wishlist')} value={wishlist} />
        <Tile
          href="/account/addresses"
          label={content.text('account.nav.addresses')}
          value={addresses}
          hint={addresses === 0 ? content.text('account.notRegistered') : undefined}
        />
      </div>

      <section aria-labelledby="recent-orders">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="recent-orders" className="text-lg text-ink">
            <SiteStyledText contentKey="account.recentOrders">{content.text('account.recentOrders')}</SiteStyledText>
          </h2>
          {orders.length > 0 && (
            <Link href="/account/orders" className="link-rule text-sm">
              <SiteStyledText contentKey="account.viewAll">{content.text('account.viewAll')}</SiteStyledText>
            </Link>
          )}
        </div>

        {orders.length === 0 ? (
          <EmptyState
            title={content.text('account.orders.empty')}
            description={content.text('account.emptyOrdersDescription')}
            action={{ label: content.text('cart.start'), href: '/' }}
          />
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="card flex flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:border-accent-3"
                >
                  <div>
                    <p className="nums font-medium text-ink">
                      {toPersianDigits(order.orderNumber)}
                    </p>
                    <p className="nums mt-1 text-sm text-ink-subtle">
                      {formatJalali(order.createdAt)} —{' '}
                      {toPersianDigits(Number(order.itemCount))} <SiteStyledText contentKey="account.item">{content.text('account.item')}</SiteStyledText>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Price amount={order.grandTotal} size="sm" />
                    <OrderStatusBadge status={order.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tile({
  href,
  label,
  value,
  hint,
  tone = 'plain',
}: {
  href: string
  label: string
  value: number
  hint?: string
  tone?: 'plain' | 'attention'
}) {
  return (
    <Link
      href={href}
      className={`card group/tile p-4 transition-colors hover:border-accent-3 md:p-5 ${
        tone === 'attention' ? 'border-warning/40 bg-warning-bg/40' : ''
      }`}
    >
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="nums mt-2 text-2xl text-ink">{toPersianDigits(value)}</p>
      <p className="mt-1 text-xs text-ink-subtle">{hint ?? ' '}</p>
    </Link>
  )
}
