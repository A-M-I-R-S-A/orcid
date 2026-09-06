import Link from 'next/link'

import { AdminEmpty, Badge, MoneyTile, PageHeader, StatTile, Table, TableWrap, Td, Th } from '@/components/admin/ui'
import { dashboardStats } from '@/modules/orders/queries'
import { pendingPaymentCount } from '@/modules/payments/service'
import { pendingCount as pendingReviewCount } from '@/modules/reviews/service'
import { failedCount, pendingApprovalCount, stalledCount } from '@/modules/sms/service'
import { requireAdmin } from '@/modules/admin/auth'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/order-status'
import { formatJalali } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'
import { formatPrice } from '@/lib/money'

export const metadata = { title: 'پیشخوان' }

export default async function AdminDashboard() {
  await requireAdmin()

  const [stats, payments, reviews, smsPending, smsStalled, smsFailed] = await Promise.all([
    dashboardStats(),
    pendingPaymentCount(),
    pendingReviewCount(),
    pendingApprovalCount(),
    stalledCount(),
    failedCount(),
  ])

  return (
    <>
      <PageHeader title="پیشخوان" description="وضعیت کلی فروشگاه و کارهای در انتظار" />

      <section aria-labelledby="queues" className="mb-8">
        <h2 id="queues" className="text-sm text-ink-muted mb-3">
          در انتظار اقدام
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="تأیید پرداخت"
            value={payments}
            hint={payments > 0 ? 'نیازمند بررسی' : 'موردی نیست'}
            href="/admin/payments?status=reference_submitted"
            tone={payments > 0 ? 'pending' : 'neutral'}
          />
          <StatTile
            label="تأیید پیامک"
            value={smsPending}
            hint={smsPending > 0 ? 'در انتظار تأیید' : 'موردی نیست'}
            href="/admin/sms"
            tone={smsPending > 0 ? 'pending' : 'neutral'}
          />
          <StatTile
            label="دیدگاه‌ها"
            value={reviews}
            hint={reviews > 0 ? 'در انتظار بررسی' : 'موردی نیست'}
            href="/admin/reviews?status=pending"
            tone={reviews > 0 ? 'pending' : 'neutral'}
          />
          <StatTile
            label="سفارش‌های در جریان"
            value={stats.orders.processing + stats.orders.pending}
            hint="در حال آماده‌سازی یا انتظار"
            href="/admin/orders"
          />
        </div>
      </section>

      {(smsStalled > 0 || smsFailed > 0) && (
        <div className="card p-5 mb-8 bg-warning-bg border-warning/40">
          <p className="font-medium text-warning mb-1">صف پیامک نیازمند بررسی است</p>
          <p className="text-sm text-warning/90 nums">
            {smsStalled > 0 && `${toPersianDigits(smsStalled)} پیامک تأییدشده هنوز ارسال نشده است. `}
            {smsFailed > 0 && `${toPersianDigits(smsFailed)} پیامک ناموفق بوده است. `}
            <Link href="/admin/sms" className="underline">
              مشاهده صف پیامک
            </Link>
          </p>
        </div>
      )}

      <section aria-labelledby="totals" className="mb-8">
        <h2 id="totals" className="text-sm text-ink-muted mb-3">
          آمار کلی
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MoneyTile
            label="درآمد ۳۰ روز اخیر"
            amount={stats.revenue.last30}
            hint="سفارش‌های پرداخت‌شده"
          />
          <MoneyTile label="درآمد کل" amount={stats.revenue.total} hint="سفارش‌های پرداخت‌شده" />
          <StatTile label="سفارش‌های پرداخت‌شده" value={stats.orders.paid} />
          <StatTile label="مشتریان" value={stats.customerCount} href="/admin/customers" />
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section aria-labelledby="recent-orders">
          <div className="flex items-center justify-between mb-3">
            <h2 id="recent-orders" className="text-sm text-ink-muted">
              آخرین سفارش‌ها
            </h2>
            <Link href="/admin/orders" className="text-xs text-accent-2 hover:underline">
              مشاهده همه
            </Link>
          </div>

          {stats.recentOrders.length === 0 ? (
            <AdminEmpty title="هنوز سفارشی ثبت نشده است" />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>شماره</Th>
                    <Th>مشتری</Th>
                    <Th>مبلغ</Th>
                    <Th>وضعیت</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-surface-sunken/50">
                      <Td>
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-accent-2 hover:underline nums"
                        >
                          {toPersianDigits(order.orderNumber)}
                        </Link>
                      </Td>
                      <Td className="text-ink-muted">{order.customerName}</Td>
                      <Td className="nums whitespace-nowrap">{formatPrice(order.grandTotal, false)}</Td>
                      <Td>
                        <Badge tone={ORDER_STATUS_TONE[order.status]}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </section>

        <section aria-labelledby="low-stock">
          <div className="flex items-center justify-between mb-3">
            <h2 id="low-stock" className="text-sm text-ink-muted">
              موجودی رو به اتمام
            </h2>
            <Link href="/admin/products" className="text-xs text-accent-2 hover:underline">
              مدیریت محصولات
            </Link>
          </div>

          {stats.lowStock.length === 0 ? (
            <AdminEmpty title="موجودی همه محصولات کافی است" />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>محصول</Th>
                    <Th>کد کالا</Th>
                    <Th>موجودی</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.lowStock.map((item) => (
                    <tr key={item.sku} className="hover:bg-surface-sunken/50">
                      <Td>
                        <Link
                          href={`/admin/products/${item.id}`}
                          className="text-accent-2 hover:underline"
                        >
                          {item.name}
                        </Link>
                      </Td>
                      <Td className="nums text-ink-muted" >
                        <span dir="ltr">{item.sku}</span>
                      </Td>
                      <Td>
                        <Badge tone={item.stockQty === 0 ? 'negative' : 'pending'}>
                          {item.stockQty === 0
                            ? 'ناموجود'
                            : `${toPersianDigits(item.stockQty)} عدد`}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </section>
      </div>

      {stats.recentReviews.length > 0 && (
        <section aria-labelledby="recent-reviews" className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 id="recent-reviews" className="text-sm text-ink-muted">
              آخرین دیدگاه‌ها
            </h2>
            <Link href="/admin/reviews" className="text-xs text-accent-2 hover:underline">
              مشاهده همه
            </Link>
          </div>

          <ul className="grid md:grid-cols-2 gap-3">
            {stats.recentReviews.map((review) => (
              <li key={review.id} className="card p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm text-ink font-medium truncate">{review.productName}</span>
                  <Badge
                    tone={
                      review.status === 'approved'
                        ? 'positive'
                        : review.status === 'pending'
                          ? 'pending'
                          : 'neutral'
                    }
                  >
                    {review.status === 'approved'
                      ? 'تأیید شده'
                      : review.status === 'pending'
                        ? 'در انتظار'
                        : 'رد شده'}
                  </Badge>
                </div>
                <p className="text-xs text-accent-2 mb-1.5">{'★'.repeat(review.rating)}</p>
                <p className="text-sm text-ink-muted line-clamp-2">{review.body}</p>
                <time
                  dateTime={review.createdAt.toISOString()}
                  className="text-xs text-ink-subtle nums mt-2 block"
                >
                  {formatJalali(review.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
