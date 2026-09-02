import Link from 'next/link'

import { EmptyState, OrderStatusBadge, Price } from '@/components/ui'
import { listForUser } from '@/modules/orders/queries'
import { requireUser } from '@/lib/session'
import { formatJalali } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'

export const metadata = { title: 'پیشخوان' }

export default async function AccountPage() {
  const user = await requireUser()
  const orders = await listForUser(user.id, 5)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl md:text-3xl text-ink">پیشخوان</h1>

      <section aria-labelledby="recent-orders">
        <div className="flex items-center justify-between mb-5">
          <h2 id="recent-orders" className="text-lg text-ink">
            آخرین سفارش‌ها
          </h2>
          {orders.length > 0 && (
            <Link href="/account/orders" className="text-sm text-accent-2 hover:underline">
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
                  className="card p-5 flex flex-wrap items-center justify-between gap-4 hover:border-accent-3 transition-colors"
                >
                  <div>
                    <p className="font-medium text-ink nums">
                      {toPersianDigits(order.orderNumber)}
                    </p>
                    <p className="text-sm text-ink-subtle nums mt-1">
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
