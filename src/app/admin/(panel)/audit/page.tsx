import { desc, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auditLogs } from '@/db/schema'
import { AdminEmpty, AdminPagination, PageHeader, Table, TableWrap, Td, Th } from '@/components/admin/ui'
import { requirePermission } from '@/modules/admin/auth'
import { AUDIT_ACTIONS, type AuditAction } from '@/lib/audit'
import { formatJalaliDateTime } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'

/**
 * Audit log. §58.
 *
 * Read-only by design — there is no edit or delete control anywhere on this
 * screen, and no action exists to build one from. A log an administrator can
 * rewrite is not evidence of anything.
 */
export const dynamic = 'force-dynamic'
export const metadata = { title: 'گزارش فعالیت' }

const PAGE_SIZE = 50

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>
}) {
  await requirePermission('audit.view')
  const { action, page: rawPage } = await searchParams

  const page = Math.max(1, Number(rawPage ?? 1) || 1)
  const where = action && action !== 'all' ? sql`${auditLogs.action} = ${action}` : undefined

  const [items, [countRow]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),

    db.select({ count: sql<number>`COUNT(*)` }).from(auditLogs).where(where),
  ])

  const total = Number(countRow?.count ?? 0)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <PageHeader
        title="گزارش فعالیت"
        description="تمام اقدامات مهم مدیران. این گزارش فقط‌خواندنی است و قابل ویرایش یا حذف نیست."
      />

      <form method="get" action="/admin/audit" className="flex gap-2 mb-5">
        <select name="action" defaultValue={action ?? 'all'} className="field py-2.5 max-w-xs">
          <option value="all">همه اقدامات</option>
          {Object.entries(AUDIT_ACTIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary btn-sm">
          فیلتر
        </button>
      </form>

      <p className="text-sm text-ink-muted mb-3 nums">{toPersianDigits(total)} رویداد</p>

      {items.length === 0 ? (
        <AdminEmpty title="رویدادی ثبت نشده است" />
      ) : (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>زمان</Th>
                  <Th>کاربر</Th>
                  <Th>اقدام</Th>
                  <Th>مورد</Th>
                  <Th>توضیح</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-sunken/50">
                    <Td className="text-xs text-ink-muted nums whitespace-nowrap">
                      {formatJalaliDateTime(entry.createdAt)}
                    </Td>
                    <Td className="text-sm">{entry.actorName}</Td>
                    <Td className="text-sm">
                      {AUDIT_ACTIONS[entry.action as AuditAction] ?? entry.action}
                    </Td>
                    <Td className="text-xs text-ink-muted">
                      {entry.entityType}
                      {entry.entityId && <span className="nums"> #{entry.entityId}</span>}
                    </Td>
                    <Td
                      className="text-xs text-ink-muted max-w-[260px] truncate"
                      title={entry.summary ?? undefined}
                    >
                      {entry.summary ?? '—'}
                    </Td>
                    <Td className="text-xs text-ink-subtle nums" >
                      <span dir="ltr">{entry.ip ?? '—'}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>

          <AdminPagination
            page={page}
            pageCount={pageCount}
            basePath="/admin/audit"
            params={{ action }}
          />
        </>
      )}
    </>
  )
}
