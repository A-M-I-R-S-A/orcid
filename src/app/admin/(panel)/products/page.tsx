import Link from 'next/link'

import { AdminEmpty, AdminPagination, Badge, FilterTabs, PageHeader, Table, TableWrap, Td, Th } from '@/components/admin/ui'
import { listProductsForAdmin } from '@/modules/catalog/admin-service'
import { requirePermission } from '@/modules/admin/auth'
import { getCurrentAdmin } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { formatPrice } from '@/lib/money'
import { mediaUrl } from '@/lib/images'
import { toPersianDigits } from '@/lib/persian'

/** Product list. §41. */
export const dynamic = 'force-dynamic'
export const metadata = { title: 'محصولات' }

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  await requirePermission('products.view')
  const admin = await getCurrentAdmin()
  const { status = 'active', q, page: rawPage } = await searchParams

  const { items, total, page, pageCount } = await listProductsForAdmin({
    status,
    search: q,
    page: Number(rawPage ?? 1) || 1,
  })

  const canCreate = admin ? hasPermission(admin, 'products.create') : false

  return (
    <>
      <PageHeader
        title="محصولات"
        description="مدیریت کاتالوگ، قیمت و موجودی"
        action={
          canCreate ? (
            <Link href="/admin/products/new" className="btn btn-primary btn-sm">
              محصول جدید
            </Link>
          ) : undefined
        }
      />

      <FilterTabs
        basePath="/admin/products"
        current={status}
        options={[
          { value: 'active', label: 'فعال' },
          { value: 'inactive', label: 'غیرفعال' },
          { value: 'archived', label: 'بایگانی' },
        ]}
      />

      <form method="get" action="/admin/products" className="flex gap-2 mb-5">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder="جستجوی نام یا نشانی محصول…"
          className="field flex-1 max-w-md py-2.5"
        />
        <button type="submit" className="btn btn-secondary btn-sm">
          جستجو
        </button>
      </form>

      <p className="text-sm text-ink-muted mb-3 nums">{toPersianDigits(total)} محصول</p>

      {items.length === 0 ? (
        <AdminEmpty title="محصولی یافت نشد" />
      ) : (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>محصول</Th>
                  <Th>دسته‌بندی</Th>
                  <Th>قیمت از</Th>
                  <Th>تنوع</Th>
                  <Th>موجودی</Th>
                  <Th>وضعیت</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((product) => (
                  <tr key={product.id} className="hover:bg-surface-sunken/50">
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-12 rounded-md overflow-hidden bg-surface-sunken shrink-0">
                          {product.imagePath && (
                            <img
                              src={mediaUrl(product.imagePath)}
                              alt=""
                              width={40}
                              height={48}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="text-accent-2 hover:underline font-medium block truncate"
                          >
                            {product.name}
                          </Link>
                          <span className="text-xs text-ink-subtle block truncate">
                            {product.slug}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-xs text-ink-muted">{product.categoryName ?? '—'}</Td>
                    <Td className="nums whitespace-nowrap">
                      {product.minPrice ? formatPrice(Number(product.minPrice), false) : '—'}
                    </Td>
                    <Td className="nums">{toPersianDigits(Number(product.variantCount))}</Td>
                    <Td>
                      <Badge
                        tone={
                          Number(product.totalStock) === 0
                            ? 'negative'
                            : Number(product.totalStock) <= 5
                              ? 'pending'
                              : 'neutral'
                        }
                      >
                        {toPersianDigits(Number(product.totalStock))}
                      </Badge>
                    </Td>
                    <Td>
                      {product.isArchived ? (
                        <Badge tone="neutral">بایگانی</Badge>
                      ) : product.isActive ? (
                        <Badge tone="positive">فعال</Badge>
                      ) : (
                        <Badge tone="pending">غیرفعال</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>

          <AdminPagination
            page={page}
            pageCount={pageCount}
            basePath="/admin/products"
            params={{ status, q }}
          />
        </>
      )}
    </>
  )
}
