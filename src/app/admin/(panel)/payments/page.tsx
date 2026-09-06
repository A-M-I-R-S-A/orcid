import Link from 'next/link'

import { AdminEmpty, AdminPagination, Badge, FilterTabs, PageHeader, Table, TableWrap, Td, Th } from '@/components/admin/ui'
import { PaymentReviewActions } from '@/components/admin/payment-actions'
import { listPayments } from '@/modules/payments/service'
import { requirePermission } from '@/modules/admin/auth'
import { hasPermission } from '@/lib/permissions'
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from '@/lib/order-status'
import { formatPrice } from '@/lib/money'
import { formatJalaliDateTime } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'پرداخت‌ها' }

const TONES: Record<PaymentStatus, 'neutral' | 'positive' | 'pending' | 'negative'> = {
  pending: 'neutral',
  reference_submitted: 'pending',
  approved: 'positive',
  rejected: 'negative',
  refunded: 'neutral',
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const admin = await requirePermission('payments.view')
  const { status = 'reference_submitted', q, page: rawPage } = await searchParams

  const { items, total, page, pageCount } = await listPayments({
    status,
    search: q,
    page: Number(rawPage ?? 1) || 1,
  })

  const canApprove = hasPermission(admin, 'payments.approve')
  const canReject = hasPermission(admin, 'payments.reject')

  return (
    <>
      <PageHeader
        title="پرداخت‌ها"
        description="بررسی و تأیید پرداخت‌های کارت به کارت"
      />

      <FilterTabs
        basePath="/admin/payments"
        current={status}
        options={[
          { value: 'reference_submitted', label: 'در انتظار تأیید' },
          { value: 'approved', label: 'تأیید شده' },
          { value: 'rejected', label: 'رد شده' },
          { value: 'pending', label: 'پرداخت نشده' },
          { value: 'all', label: 'همه' },
        ]}
      />

      <form method="get" action="/admin/payments" className="flex gap-2 mb-5">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder="جستجوی کد رهگیری، شماره سفارش یا موبایل…"
          className="field flex-1 max-w-md py-2.5"
          dir="auto"
        />
        <button type="submit" className="btn btn-secondary btn-sm">
          جستجو
        </button>
      </form>

      <p className="text-sm text-ink-muted mb-3 nums">{toPersianDigits(total)} پرداخت</p>

      {items.length === 0 ? (
        <AdminEmpty
          title="پرداختی یافت نشد"
          description="با فیلتر انتخاب‌شده موردی وجود ندارد."
        />
      ) : (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>سفارش</Th>
                  <Th>مشتری</Th>
                  <Th>مبلغ</Th>
                  <Th>کد رهگیری</Th>
                  <Th>زمان ثبت</Th>
                  <Th>وضعیت</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {items.map((payment) => (
                  <tr key={payment.id} className="hover:bg-surface-sunken/50">
                    <Td>
                      <Link
                        href={`/admin/orders/${payment.orderId}`}
                        className="text-accent-2 hover:underline nums"
                      >
                        {toPersianDigits(payment.orderNumber)}
                      </Link>
                    </Td>
                    <Td>
                      <span className="text-ink">{payment.customerName}</span>
                      <span className="block text-xs text-ink-subtle nums" dir="ltr">
                        {payment.customerPhone}
                      </span>
                    </Td>
                    <Td className="nums whitespace-nowrap">{formatPrice(payment.amount, false)}</Td>
                    <Td>
                      {payment.referenceCode ? (
                        <span className="nums font-medium select-all" dir="ltr">
                          {payment.referenceCode}
                        </span>
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                    </Td>
                    <Td className="text-xs text-ink-muted nums whitespace-nowrap">
                      {payment.referenceSubmittedAt
                        ? formatJalaliDateTime(payment.referenceSubmittedAt)
                        : '—'}
                    </Td>
                    <Td>
                      <Badge tone={TONES[payment.status]}>
                        {PAYMENT_STATUS_LABELS[payment.status]}
                      </Badge>
                    </Td>
                    <Td>
                      {payment.status === 'reference_submitted' && (canApprove || canReject) ? (
                        <PaymentReviewActions
                          paymentId={payment.id}
                          canApprove={canApprove}
                          canReject={canReject}
                        />
                      ) : payment.adminNote ? (
                        <span className="text-xs text-ink-subtle" title={payment.adminNote}>
                          یادداشت دارد
                        </span>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>

          <AdminPagination
            page={page}
            pageCount={pageCount}
            basePath="/admin/payments"
            params={{ status, q }}
          />
        </>
      )}
    </>
  )
}
