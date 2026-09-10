import Link from 'next/link'

import { AdminEmpty, Badge, PageHeader, Table, TableWrap, Td, Th } from '@/components/admin/ui'
import { GetLaterCreate } from '@/components/admin/get-later-create'
import { formatJalaliDateTime } from '@/lib/jalali'
import { formatPrice } from '@/lib/money'
import { toPersianDigits } from '@/lib/persian'
import { requirePermission } from '@/modules/admin/auth'
import { getConfig, listForAdmin } from '@/modules/get-later/service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'سبد پرداخت بعدی' }

const STATUS = {
  draft: { label: 'پیش‌نویس', tone: 'neutral' as const },
  open: { label: 'منتظر مشتری', tone: 'pending' as const },
  submitted: { label: 'همه بازگشتی', tone: 'neutral' as const },
  converted: { label: 'تبدیل به سفارش', tone: 'positive' as const },
  cancelled: { label: 'لغوشده', tone: 'negative' as const },
}

export default async function AdminGetLaterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  await requirePermission('orders.update_status')
  const params = await searchParams
  const [carts, config] = await Promise.all([
    listForAdmin({ search: params.q, status: params.status }),
    getConfig(),
  ])

  return (
    <>
      <PageHeader title="سبد پرداخت بعدی" description="ساخت سبد برای مشتری یا مدیریت سبدهایی که مشتریان ایجاد کرده‌اند" />

      <GetLaterCreate />

      {!config.enabled && (
        <div className="mb-5 rounded-lg border border-warning/40 bg-warning-bg p-4 text-sm text-warning">
          این قابلیت در تنظیمات غیرفعال است. پیش‌نویس‌ها حفظ می‌شوند اما پیش از استفاده آن را فعال کنید.
        </div>
      )}

      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <label htmlFor="get-later-search" className="sr-only">جستجوی نام یا موبایل مشتری</label>
        <input id="get-later-search" name="q" type="search" defaultValue={params.q ?? ''} placeholder="نام یا موبایل مشتری…" className="field max-w-md flex-1" />
        <label htmlFor="get-later-status" className="sr-only">فیلتر وضعیت سبد</label>
        <select id="get-later-status" name="status" defaultValue={params.status ?? 'all'} className="field w-auto">
          <option value="all">همه وضعیت‌ها</option>
          {Object.entries(STATUS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </select>
        <button type="submit" className="btn btn-secondary btn-sm">جستجو</button>
      </form>

      {carts.length === 0 ? (
        <AdminEmpty title="سبدی پیدا نشد" description="می‌توانید با شماره موبایل مشتری یک پیش‌نویس جدید بسازید." />
      ) : (
        <TableWrap>
          <Table>
            <thead><tr><Th>شماره</Th><Th>مشتری</Th><Th>اقلام</Th><Th>ارزش بسته</Th><Th>مهلت</Th><Th>وضعیت</Th><Th /></tr></thead>
            <tbody>
              {carts.map((cart) => (
                <tr key={cart.id} className="hover:bg-surface-sunken/50">
                  <Td className="nums">#{toPersianDigits(cart.id)}</Td>
                  <Td><span className="text-ink">{cart.customerName || 'بدون نام'}</span><span className="nums block text-xs text-ink-subtle" dir="ltr">{cart.customerPhone}</span></Td>
                  <Td className="nums">{toPersianDigits(Number(cart.itemCount))}</Td>
                  <Td className="nums whitespace-nowrap">{formatPrice(Number(cart.total), false)}</Td>
                  <Td className="nums whitespace-nowrap">{cart.expiresAt ? formatJalaliDateTime(cart.expiresAt) : '—'}</Td>
                  <Td><Badge tone={STATUS[cart.status].tone}>{STATUS[cart.status].label}</Badge></Td>
                  <Td><Link href={`/admin/get-later/${cart.id}`} className="text-accent-2 hover:underline">مدیریت</Link></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  )
}
