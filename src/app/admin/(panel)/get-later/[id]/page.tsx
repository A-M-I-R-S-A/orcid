import Link from 'next/link'
import { notFound } from 'next/navigation'

import { GetLaterAdminManager } from '@/components/admin/get-later-manager'
import { Badge, PageHeader } from '@/components/admin/ui'
import { formatJalaliDateTime } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'
import { requirePermission } from '@/modules/admin/auth'
import { getForAdmin } from '@/modules/get-later/service'

export const metadata = { title: 'مدیریت سبد پرداخت بعدی' }

const STATUS = {
  draft: { label: 'پیش‌نویس', tone: 'neutral' as const },
  open: { label: 'منتظر تصمیم مشتری', tone: 'pending' as const },
  submitted: { label: 'همه اقلام بازگشتی', tone: 'neutral' as const },
  converted: { label: 'تبدیل به سفارش', tone: 'positive' as const },
  cancelled: { label: 'لغوشده', tone: 'negative' as const },
}

export default async function AdminGetLaterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('orders.update_status')
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const cart = await getForAdmin(id)
  if (!cart) notFound()

  const expiresInput = cart.expiresAt
    ? new Date(cart.expiresAt.getTime() - cart.expiresAt.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
    : ''

  return (
    <>
      <PageHeader
        title={`سبد شماره ${toPersianDigits(cart.id)}`}
        description={`${cart.customerName || 'بدون نام'} • ${cart.customerPhone}`}
        action={<Badge tone={STATUS[cart.status].tone}>{STATUS[cart.status].label}</Badge>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-ink-muted">
        <Link href="/admin/get-later" className="text-accent-2 hover:underline">← همه سبدها</Link>
        {cart.expiresAt && <span className="nums">مهلت: {formatJalaliDateTime(cart.expiresAt)}</span>}
        {cart.orderId && <Link href={`/admin/orders/${cart.orderId}`} className="btn btn-secondary btn-sm">مشاهده سفارش ایجادشده</Link>}
      </div>

      <GetLaterAdminManager cart={{
        id: cart.id,
        status: cart.status,
        adminNote: cart.adminNote,
        expiresInput,
        items: cart.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          variantLabel: item.variantLabel,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          decision: item.decision,
        })),
      }} />
    </>
  )
}
