import { desc } from 'drizzle-orm'

import { db } from '@/db'
import { smsMessages, smsTemplates } from '@/db/schema'
import { AdminEmpty, Badge, PageHeader, Table, TableWrap, Td, Th } from '@/components/admin/ui'
import { SmsQueueActions, SmsConfigForm, SmsTemplateRow } from '@/components/admin/sms-controls'
import { requirePermission } from '@/modules/admin/auth'
import { getProvider } from '@/modules/sms/provider'
import { failedCount, pendingApprovalCount, stalledCount } from '@/modules/sms/service'
import { hasPermission } from '@/lib/permissions'
import { getNamespace, hasSecret } from '@/lib/settings'
import { formatJalaliDateTime } from '@/lib/jalali'
import { maskPhone, toPersianDigits } from '@/lib/persian'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'پیامک' }

const EVENT_LABELS: Record<string, string> = {
  otp_login: 'کد ورود (OTP)',
  order_created: 'تأیید سفارش مشتری',
  payment_approved: 'تأیید پرداخت',
  order_shipped: 'ارسال سفارش',
  admin_new_order: 'اعلان سفارش جدید برای مدیر',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار تأیید',
  approved: 'تأیید شده — در صف',
  sending: 'در حال ارسال',
  sent: 'ارسال شده',
  failed: 'ناموفق',
  cancelled: 'لغو شده',
}

export default async function AdminSmsPage() {
  const admin = await requirePermission('sms.view')

  const canApprove = hasPermission(admin, 'sms.approve')
  const canConfigure = hasPermission(admin, 'sms.configure')

  const [queue, templates, pending, stalled, failed, apiKeySet, smsSettings] = await Promise.all([
    db
      .select()
      .from(smsMessages)
      .orderBy(desc(smsMessages.createdAt))
      .limit(50),
    db.select().from(smsTemplates).orderBy(smsTemplates.id),
    pendingApprovalCount(),
    stalledCount(),
    failedCount(),
    hasSecret('sms', 'apiKey'),
    getNamespace('sms'),
  ])

  const provider = await getProvider()
  const credit = apiKeySet ? await provider.getCredit() : null

  const pendingIds = queue.filter((m) => m.status === 'pending').map((m) => m.id)

  return (
    <>
      <PageHeader
        title="پیامک"
        description="صف تأیید، تنظیمات سرویس و قالب‌های پیامک"
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-7">
        <div className="card p-4">
          <p className="text-xs text-ink-muted mb-1.5">در انتظار تأیید</p>
          <p className="text-xl nums text-ink">{toPersianDigits(pending)}</p>
        </div>
        <div className={`card p-4 ${stalled > 0 ? 'bg-warning-bg border-warning/40' : ''}`}>
          <p className="text-xs text-ink-muted mb-1.5">تأییدشده، ارسال نشده</p>
          <p className="text-xl nums text-ink">{toPersianDigits(stalled)}</p>
        </div>
        <div className={`card p-4 ${failed > 0 ? 'bg-danger-bg border-danger/30' : ''}`}>
          <p className="text-xs text-ink-muted mb-1.5">ناموفق</p>
          <p className="text-xl nums text-ink">{toPersianDigits(failed)}</p>
        </div>
      </div>

      {canApprove && (
        <div className="card p-5 mb-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-ink font-medium">ارسال دستی صف</p>
              <p className="text-xs text-ink-muted mt-1">
                اگر زمان‌بند خودکار روی سرور فعال نباشد، پیامک‌های تأییدشده با این دکمه ارسال می‌شوند.
              </p>
            </div>
            <SmsQueueActions pendingIds={pendingIds} canApprove={canApprove} />
          </div>
        </div>
      )}

      <section aria-labelledby="queue" className="mb-8">
        <h2 id="queue" className="text-sm text-ink-muted mb-3">
          صف پیامک
        </h2>

        {queue.length === 0 ? (
          <AdminEmpty title="پیامکی در صف نیست" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>رویداد</Th>
                  <Th>شماره</Th>
                  <Th>وضعیت</Th>
                  <Th>تلاش</Th>
                  <Th>زمان</Th>
                  <Th>خطا</Th>
                </tr>
              </thead>
              <tbody>
                {queue.map((message) => (
                  <tr key={message.id} className="hover:bg-surface-sunken/50">
                    <Td className="text-xs">{EVENT_LABELS[message.event] ?? message.event}</Td>
                    <Td className="nums text-xs">{maskPhone(message.phone)}</Td>
                    <Td>
                      <Badge
                        tone={
                          message.status === 'sent'
                            ? 'positive'
                            : message.status === 'failed'
                              ? 'negative'
                              : message.status === 'pending'
                                ? 'pending'
                                : 'neutral'
                        }
                      >
                        {STATUS_LABELS[message.status] ?? message.status}
                      </Badge>
                    </Td>
                    <Td className="nums text-xs">
                      {toPersianDigits(message.attempts)}/{toPersianDigits(message.maxAttempts)}
                    </Td>
                    <Td className="text-xs nums whitespace-nowrap">
                      {formatJalaliDateTime(message.createdAt)}
                    </Td>
                    <Td className="text-xs text-danger max-w-[220px] truncate" title={message.lastError ?? ''}>
                      {message.lastError ?? '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      <section aria-labelledby="templates" className="mb-8">
        <h2 id="templates" className="text-sm text-ink-muted mb-3">
          قالب‌های پیامک
        </h2>

        <div className="space-y-3">
          {templates.map((template) => (
            <SmsTemplateRow
              key={template.id}
              template={{
                id: template.id,
                event: template.event,
                label: EVENT_LABELS[template.event] ?? template.event,
                providerTemplateId: template.providerTemplateId ?? '',
                isEnabled: template.isEnabled,
                requiresApproval: template.requiresApproval,
                parameters: normalizeParameters(template.parameters),
              }}
              canEdit={canConfigure}
            />
          ))}
        </div>
      </section>

      {canConfigure && (
        <section aria-labelledby="config">
          <h2 id="config" className="text-sm text-ink-muted mb-3">
            تنظیمات سرویس SMS.ir
          </h2>
          <SmsConfigForm apiKeySet={apiKeySet} credit={credit} adminOrderPhone={smsSettings.adminOrderPhone ?? ''} adminOrderTrigger={smsSettings.adminOrderTrigger ?? 'order_created'} />
        </section>
      )}
    </>
  )
}

function normalizeParameters(value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, string>
  return Array.isArray(value) ? Object.fromEntries(value.filter((key): key is string => typeof key === 'string').map((key) => [key, key])) : {}
}
