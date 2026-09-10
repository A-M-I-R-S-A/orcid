import Link from 'next/link'

import { EmptyState, OrderStatusBadge, Price } from '@/components/ui'
import { listForUser } from '@/modules/orders/queries'
import { addressCount, wishlistCount } from '@/modules/account/service'
import { requireUser } from '@/lib/session'
import { formatJalali } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'
import { activeCountForUser, getConfig as getLaterConfig } from '@/modules/get-later/service'

export const metadata = { title: 'پیشخوان' }

export default async function AccountPage() {
  const user = await requireUser()

  const [orders, wishlist, addresses, getLater, getLaterSettings] = await Promise.all([
    listForUser(user.id, 4),
    wishlistCount(user.id),
    addressCount(user.id),
    activeCountForUser(user.id),
    getLaterConfig(),
  ])

  const awaiting = orders.filter(
    (o) => o.status === 'awaiting_payment' || o.status === 'payment_verification',
  ).length

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow mb-3">حساب کاربری</p>
        <h1 className="section-title">
          {user.fullName ? `سلام ${user.fullName.split(' ')[0]}` : 'پیشخوان'}
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Tile
          href="/account/orders"
          label="سفارش‌ها"
          value={orders.length}
          hint={awaiting > 0 ? `${toPersianDigits(awaiting)} در انتظار پرداخت` : undefined}
          tone={awaiting > 0 ? 'attention' : 'plain'}
        />
        {(getLaterSettings.enabled || getLater > 0) && (
          <Tile
            href="/account/get-later"
            label="سبد پرداخت بعدی"
            value={getLater}
            hint={getLater > 0 ? 'منتظر تصمیم شما' : 'سبد فعالی ندارید'}
            tone={getLater > 0 ? 'attention' : 'plain'}
          />
        )}
        <Tile href="/account/wishlist" label="علاقه‌مندی‌ها" value={wishlist} />
        <Tile
          href="/account/addresses"
          label="نشانی‌ها"
          value={addresses}
          hint={addresses === 0 ? 'هنوز ثبت نشده' : undefined}
        />
      </div>

      <section aria-labelledby="recent-orders">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="recent-orders" className="text-lg text-ink">
            آخرین سفارش‌ها
          </h2>
          {orders.length > 0 && (
            <Link href="/account/orders" className="link-rule text-sm">
              مشاهده همه
            </Link>
          )}
        </div>

        {orders.length === 0 ? (
          <EmptyState
            title="هنوز سفارشی ثبت نکرده‌اید"
            description="پس از اولین خرید، سفارش‌های شما اینجا نمایش داده می‌شود."
            action={{ label: 'شروع خرید', href: '/' }}
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
                      {toPersianDigits(Number(order.itemCount))} کالا
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
