'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { approveSmsAction, dispatchSmsAction } from '@/modules/admin/actions'
import { saveSettingsAction, saveSmsTemplateAction } from '@/modules/admin/settings-actions'
import { toPersianDigits } from '@/lib/persian'

export function SmsQueueActions({
  pendingIds,
  canApprove,
}: {
  pendingIds: number[]
  canApprove: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  if (!canApprove) return null

  const approveAll = () =>
    startTransition(async () => {
      const result = await approveSmsAction(pendingIds)
      setMessage(
        result.ok
          ? `${toPersianDigits(result.data.approved)} پیامک تأیید شد.`
          : result.error,
      )
      router.refresh()
    })

  const dispatch = () =>
    startTransition(async () => {
      const result = await dispatchSmsAction()
      setMessage(
        result.ok
          ? `${toPersianDigits(result.data.sent)} ارسال شد، ${toPersianDigits(result.data.failed)} ناموفق.`
          : result.error,
      )
      router.refresh()
    })

  return (
    <div className="flex flex-wrap items-center gap-3">
      {pendingIds.length > 0 && (
        <button type="button" onClick={approveAll} disabled={pending} className="btn btn-primary btn-sm">
          تأیید {toPersianDigits(pendingIds.length)} پیامک در انتظار
        </button>
      )}
      <button type="button" onClick={dispatch} disabled={pending} className="btn btn-secondary btn-sm">
        {pending ? 'در حال ارسال…' : 'ارسال صف'}
      </button>
      {message && <span className="text-xs text-ink-muted">{message}</span>}
    </div>
  )
}

export function SmsTemplateRow({
  template,
  canEdit,
}: {
  template: {
    id: number
    event: string
    label: string
    providerTemplateId: string
    isEnabled: boolean
    requiresApproval: boolean
    parameters: Record<string, string>
  }
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [templateId, setTemplateId] = useState(template.providerTemplateId)
  const [enabled, setEnabled] = useState(template.isEnabled)
  const [approval, setApproval] = useState(template.requiresApproval)
  const [parameters, setParameters] = useState(template.parameters)
  const [saved, setSaved] = useState(false)

  const isOtp = template.event === 'otp_login'

  const save = () =>
    startTransition(async () => {
      const result = await saveSmsTemplateAction({
        id: template.id,
        providerTemplateId: templateId,
        isEnabled: enabled,
        requiresApproval: isOtp ? false : approval,
        parameters,
      })
      setSaved(result.ok)
      router.refresh()
    })

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[160px]">
          <p className="text-sm text-ink font-medium">{template.label}</p>
          <p className="text-xs text-ink-subtle mt-0.5" dir="ltr">
            {template.event}
          </p>
        </div>

        <div className="w-40">
          <label htmlFor={`tpl-${template.id}`} className="sr-only">
            شناسه قالب در SMS.ir
          </label>
          <input
            id={`tpl-${template.id}`}
            value={templateId}
            onChange={(event) => {
              setTemplateId(event.target.value)
              setSaved(false)
            }}
            disabled={!canEdit}
            placeholder="Template ID"
            dir="ltr"
            className="field py-2 text-sm nums"
          />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked)
              setSaved(false)
            }}
            disabled={!canEdit}
            className="accent-[var(--color-accent)]"
          />
          فعال
        </label>

        <label
          className={`flex items-center gap-2 text-sm ${isOtp ? 'opacity-50' : 'cursor-pointer'}`}
          title={isOtp ? 'کد ورود بلافاصله ارسال می‌شود و تأیید مدیر ندارد.' : undefined}
        >
          <input
            type="checkbox"
            checked={isOtp ? false : approval}
            onChange={(event) => {
              setApproval(event.target.checked)
              setSaved(false)
            }}
            disabled={!canEdit || isOtp}
            className="accent-[var(--color-accent)]"
          />
          نیازمند تأیید مدیر
        </label>

        {canEdit && (
          <button type="button" onClick={save} disabled={pending} className="btn btn-secondary btn-sm">
            {pending ? '…' : saved ? 'ذخیره شد' : 'ذخیره'}
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(parameters).map(([field, parameterName]) => (
          <label key={field} className="text-xs text-ink-muted">
            {PARAMETER_LABELS[field] ?? field}
            <input value={parameterName} onChange={(event) => { setParameters({ ...parameters, [field]: event.target.value }); setSaved(false) }} disabled={!canEdit} dir="ltr" className="field mt-1 py-2 text-sm" placeholder="نام پارامتر در SMS.ir" />
          </label>
        ))}
      </div>
    </div>
  )
}

const PARAMETER_LABELS: Record<string, string> = {
  CODE: 'کد ورود', ORDER: 'شماره سفارش', NAME: 'نام مشتری', SHIPMENT: 'نام شرکت ارسال', TRACK: 'کد رهگیری',
}

export function SmsConfigForm({
  apiKeySet,
  credit,
  adminOrderPhone,
  adminOrderTrigger,
}: {
  apiKeySet: boolean
  credit: number | null
  adminOrderPhone: string
  adminOrderTrigger: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  return (
    <form
      className="card p-5 space-y-5"
      action={(formData) => {
        setMessage(null)
        startTransition(async () => {
          const result = await saveSettingsAction('sms', {
            apiKey: String(formData.get('apiKey') ?? ''),
            provider: 'sms_ir',
            adminOrderPhone: String(formData.get('adminOrderPhone') ?? ''),
            adminOrderTrigger: String(formData.get('adminOrderTrigger') ?? 'order_created'),
          })

          setMessage(
            result.ok
              ? { tone: 'ok', text: 'تنظیمات ذخیره شد.' }
              : { tone: 'error', text: result.error },
          )
          router.refresh()
        })
      }}
    >
      <div>
        <label htmlFor="apiKey" className="label">
          کلید API سرویس SMS.ir
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          dir="ltr"
          autoComplete="off"
          className="field"
          placeholder={apiKeySet ? '•••••••• (برای تغییر، مقدار جدید را وارد کنید)' : 'کلید API را وارد کنید'}
        />
        <p className="hint">
          {apiKeySet
            ? 'کلید ذخیره شده است. برای حفظ آن، این فیلد را خالی بگذارید.'
            : 'این کلید رمزنگاری‌شده ذخیره می‌شود و هرگز نمایش داده نمی‌شود.'}
        </p>
      </div>
      <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <div><label htmlFor="adminOrderPhone" className="label">شماره مدیر برای اعلان سفارش جدید</label><input id="adminOrderPhone" name="adminOrderPhone" defaultValue={adminOrderPhone} dir="ltr" inputMode="numeric" maxLength={11} className="field nums" placeholder="0912xxxxxxx" /><p className="hint">اگر خالی بماند، اعلان مدیر ارسال نمی‌شود.</p></div>
        <div><label htmlFor="adminOrderTrigger" className="label">مرحله ارسال اعلان مدیر</label><select id="adminOrderTrigger" name="adminOrderTrigger" defaultValue={adminOrderTrigger} className="field"><option value="order_created">پس از ثبت سفارش</option><option value="paid">پس از پرداخت موفق</option><option value="processing">هنگام آماده‌سازی</option><option value="shipped">هنگام ارسال</option></select><p className="hint">قالب اعلان مدیر فقط شماره سفارش را دریافت می‌کند.</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-line">
        <div className="text-sm">
          <span className="text-ink-muted">وضعیت: </span>
          {apiKeySet ? (
            <span className="text-success">پیکربندی شده</span>
          ) : (
            <span className="text-warning">پیکربندی نشده</span>
          )}
        </div>

        <div className="text-sm">
          <span className="text-ink-muted">اعتبار: </span>
          <span className="nums">
            {credit == null ? 'نامشخص' : `${toPersianDigits(Math.round(credit))} پیامک`}
          </span>
        </div>

        <button type="submit" disabled={pending} className="btn btn-primary btn-sm ms-auto">
          {pending ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}
        </button>
      </div>

      {message && (
        <p className={`text-sm ${message.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
          {message.text}
        </p>
      )}
    </form>
  )
}
