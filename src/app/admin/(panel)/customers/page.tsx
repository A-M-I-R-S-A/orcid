import Link from 'next/link'
import { desc, sql } from 'drizzle-orm'

import { db } from '@/db'
import { users } from '@/db/schema'
import { AdminEmpty, AdminPagination, Badge, PageHeader, Table, TableWrap, Td, Th } from '@/components/admin/ui'
import { CustomerStatusToggle } from '@/components/admin/customer-toggle'
import { requirePermission } from '@/modules/admin/auth'
import { getCurrentAdmin } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { formatPrice } from '@/lib/money'
import { formatJalali } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'مشتریان' }

const PAGE_SIZE = 30

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  await requirePermission('customers.view')
  const admin = await getCurrentAdmin()
  const { q, page: rawPage } = await searchParams

  const page = Math.max(1, Number(rawPage ?? 1) || 1)

  const where = q
    ? sql`(${users.phone} LIKE ${`%${q}%`} OR ${users.fullName} LIKE ${`%${q}%`})`
    : undefined

  const [items, [countRow]] = await Promise.all([
    db
      .select({
        id: users.id,
        phone: users.phone,
        fullName: users.fullName,
        isActive: users.isActive,
        phoneVerifiedAt: users.phoneVerifiedAt,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        orderCount: sql<number>`(SELECT COUNT(*) FROM orders WHERE user_id = ${users.id})`,
        totalSpent: sql<number>`(SELECT COALESCE(SUM(grand_total), 0) FROM orders WHERE user_id = ${users.id} AND status IN ('paid','processing','shipped','delivered'))`,
        reviewCount: sql<number>`(SELECT COUNT(*) FROM reviews WHERE user_id = ${users.id})`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),

    db.select({ count: sql<number>`COUNT(*)` }).from(users).where(where),
  ])

  const total = Number(countRow?.count ?? 0)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canManage = admin ? hasPermission(admin, 'customers.manage') : false

  return (
    <>
      <PageHeader title="مشتریان" description="فهرست مشتریان و سابقه خرید آن‌ها" />

      <form method="get" action="/admin/customers" className="flex gap-2 mb-5">
        <input
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder="جستجوی شماره موبایل یا نام…"
          className="field flex-1 max-w-md py-2.5"
        />
        <button type="submit" className="btn btn-secondary btn-sm">
          جستجو
        </button>
      </form>

      <p className="text-sm text-ink-muted mb-3 nums">{toPersianDigits(total)} مشتری</p>

      {items.length === 0 ? (
        <AdminEmpty title="مشتری یافت نشد" />
      ) : (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>مشتری</Th>
                  <Th>تأیید شماره</Th>
                  <Th>سفارش‌ها</Th>
                  <Th>مجموع خرید</Th>
                  <Th>دیدگاه</Th>
                  <Th>عضویت</Th>
                  <Th>وضعیت</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((customer) => (
                  <tr key={customer.id} className="hover:bg-surface-sunken/50">
                    <Td>
                      <span className="text-ink">{customer.fullName || 'بدون نام'}</span>
                      <span className="block text-xs text-ink-subtle nums" dir="ltr">
                        {customer.phone}
                      </span>
                    </Td>
                    <Td>
                      {customer.phoneVerifiedAt ? (
                        <Badge tone="positive">تأیید شده</Badge>
                      ) : (
                        <Badge tone="pending">تأیید نشده</Badge>
                      )}
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/orders?q=${encodeURIComponent(customer.phone)}`}
                        className="text-accent-2 hover:underline nums"
                      >
                        {toPersianDigits(Number(customer.orderCount))}
                      </Link>
                    </Td>
                    <Td className="nums whitespace-nowrap">
                      {formatPrice(Number(customer.totalSpent), false)}
                    </Td>
                    <Td className="nums">{toPersianDigits(Number(customer.reviewCount))}</Td>
                    <Td className="text-xs text-ink-muted nums whitespace-nowrap">
                      {formatJalali(customer.createdAt)}
                    </Td>
                    <Td>
                      {canManage ? (
                        <CustomerStatusToggle
                          userId={customer.id}
                          isActive={customer.isActive}
                        />
                      ) : (
                        <Badge tone={customer.isActive ? 'positive' : 'negative'}>
                          {customer.isActive ? 'فعال' : 'غیرفعال'}
                        </Badge>
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
            basePath="/admin/customers"
            params={{ q }}
          />
        </>
      )}
    </>
  )
}
