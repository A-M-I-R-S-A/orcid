import Link from 'next/link'

import { EmptyState, OrderStatusBadge, Price } from '@/components/ui'
import { listForUser } from '@/modules/orders/queries'
import { requireUser } from '@/lib/session'
import { formatJalali } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'

export const metadata = { title: 'سفارش‌های من' }

export default async function OrdersPage() {
  const user = await requireUser()
  const orders = await listForUser(user.id)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl md:text-3xl text-ink">سفارش‌های من</h1>

      {orders.length === 0 ? (
        <EmptyState
          title="هنوز سفارشی ثبت نکرده‌اید"
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
                  <p className="font-medium text-ink nums">{toPersianDigits(order.orderNumber)}</p>
                  <p className="text-sm text-ink-subtle nums mt-1">
                    {formatJalali(order.createdAt)} — {toPersianDigits(Number(order.itemCount))} کالا
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
    </div>
  )
}
