import Link from 'next/link'

import { AdminEmpty, AdminPagination, Badge, FilterTabs, PageHeader, Table, TableWrap, Td, Th } from '@/components/admin/ui'
import { listForAdmin } from '@/modules/orders/queries'
import { requirePermission } from '@/modules/admin/auth'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/order-status'
import { formatPrice } from '@/lib/money'
import { formatJalaliDateTime } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'سفارش‌ها' }

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  await requirePermission('orders.view')
  const { status = 'all', q, page: rawPage } = await searchParams

  const { items, total, page, pageCount } = await listForAdmin({
    status,
    search: q,
    page: Number(rawPage ?? 1) || 1,
  })

  return (
    <>
      <PageHeader title="سفارش‌ها" description="مدیریت و پیگیری سفارش‌های مشتریان" />

      <FilterTabs
        basePath="/admin/orders"
        current={status}
        options={[
          { value: 'all', label: 'همه' },
          { value: 'payment_verification', label: 'در انتظار تأیید پرداخت' },
          { value: 'paid', label: 'پرداخت شده' },
          { value: 'processing', label: 'در حال آماده‌سازی' },
          { value: 'shipped', label: 'ارسال شده' },
          { value: 'delivered', label: 'تحویل شده' },
          { value: 'cancelled', label: 'لغو شده' },
        ]}
      />

      <form method="get" action="/admin/orders" className="mb-5">
        <input type="hidden" name="status" value={status} />
        <div className="flex gap-2">
          <input
            name="q"
            type="search"
            defaultValue={q ?? ''}
            placeholder="شماره سفارش، کد رهگیری، نام، موبایل یا کد پستی…"
            aria-describedby="order-search-hint"
            className="field flex-1 max-w-md py-2.5"
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            جستجو
          </button>
          {q && (
            <Link href={`/admin/orders?status=${encodeURIComponent(status)}`} className="btn btn-ghost btn-sm">
              پاک کردن
            </Link>
          )}
        </div>
        <p id="order-search-hint" className="mt-2 text-xs text-ink-subtle">
          شماره سفارش را کامل یا بخشی از آن وارد کنید — مثلاً <span className="nums">۴۲</span> یا{' '}
          <span className="nums">ORC-۱۴۰۵-۰۰۰۰۴۲</span>. ارقام فارسی و انگلیسی هر دو پذیرفته می‌شوند.
        </p>
      </form>

      <p className="text-sm text-ink-muted mb-3 nums">
        {toPersianDigits(total)} سفارش
        {q && <span className="text-ink-subtle"> برای «{q}»</span>}
      </p>

      {items.length === 0 ? (
        <AdminEmpty
          title="سفارشی یافت نشد"
          description={
            q
              ? 'عبارت جستجو را بررسی کنید، یا جستجو را پاک کنید تا همهٔ سفارش‌ها نمایش داده شود.'
              : undefined
          }
        />
      ) : (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>شماره سفارش</Th>
                  <Th>مشتری</Th>
                  <Th>مبلغ</Th>
                  <Th>روش پرداخت</Th>
                  <Th>تاریخ</Th>
                  <Th>وضعیت</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-sunken/50">
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-accent-2 hover:underline nums font-medium"
                      >
                        {toPersianDigits(order.orderNumber)}
                      </Link>
                    </Td>
                    <Td>
                      <span className="text-ink">{order.customerName}</span>
                      <span className="block text-xs text-ink-subtle nums" dir="ltr">
                        {order.customerPhone}
                      </span>
                    </Td>
                    <Td className="nums whitespace-nowrap">{formatPrice(order.grandTotal, false)}</Td>
                    <Td className="text-xs text-ink-muted">
                      {order.paymentMethod === 'card_to_card' ? 'کارت به کارت' : order.paymentMethod}
                    </Td>
                    <Td className="text-xs text-ink-muted nums whitespace-nowrap">
                      {formatJalaliDateTime(order.createdAt)}
                    </Td>
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

          <AdminPagination
            page={page}
            pageCount={pageCount}
            basePath="/admin/orders"
            params={{ status, q }}
          />
        </>
      )}
    </>
  )
}
