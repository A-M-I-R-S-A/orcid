import { AdminEmpty, AdminPagination, FilterTabs, PageHeader, StatTile } from '@/components/admin/ui'
import { InventoryManager } from '@/components/admin/inventory-manager'
import { requirePermission } from '@/modules/admin/auth'
import { listInventoryForAdmin } from '@/modules/catalog/admin-service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'انبار' }

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requirePermission('products.inventory')
  const { status = 'all', q, page: rawPage } = await searchParams
  const safeStatus = status === 'low' || status === 'out' ? status : 'all'
  const result = await listInventoryForAdmin({ status: safeStatus, search: q, page: Number(rawPage ?? 1) || 1 })

  return <>
    <PageHeader title="انبار" description="کنترل موجودی تمام تنوع‌های محصولات از یک بخش" />
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><StatTile label="کل واحد موجود" value={result.stats.totalUnits} /><StatTile label="تنوع کم‌موجود" value={result.stats.lowCount} tone="pending" /><StatTile label="تنوع ناموجود" value={result.stats.outCount} tone="negative" /></div>
    <FilterTabs basePath="/admin/inventory" current={safeStatus} options={[{ value: 'all', label: 'همه' }, { value: 'low', label: 'کم‌موجود' }, { value: 'out', label: 'ناموجود' }]} />
    <form method="get" action="/admin/inventory" className="mb-5 flex gap-2"><input type="hidden" name="status" value={safeStatus} /><input name="q" type="search" defaultValue={q ?? ''} placeholder="جستجوی نام محصول یا SKU…" className="field max-w-md flex-1 py-2.5" /><button className="btn btn-secondary btn-sm">جستجو</button></form>
    {result.items.length ? <><InventoryManager items={result.items} /><AdminPagination page={result.page} pageCount={result.pageCount} basePath="/admin/inventory" params={{ status: safeStatus, q }} /></> : <AdminEmpty title="موردی در انبار پیدا نشد" />}
  </>
}
