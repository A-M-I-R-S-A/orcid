'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { sendOrderSmsAction, sendShipmentSmsAction } from '@/modules/admin/actions'

type Message = { id: number; event: string; status: string; attempts: number; last_error?: string | null; sent_at?: string | Date | null }

const eventLabels: Record<string, string> = {
  order_created: 'پیامک تأیید سفارش',
  payment_approved: 'پیامک تأیید پرداخت',
  order_shipped: 'پیامک رهگیری مرسوله',
}
const statusLabels: Record<string, string> = { pending: 'در انتظار تأیید', approved: 'در صف ارسال', sending: 'در حال ارسال', sent: 'ارسال شده', failed: 'ناموفق', cancelled: 'لغو شده' }

export function OrderSmsPanel({ orderId, orderStatus, company, trackingCode, messages, canSend }: {
  orderId: number
  orderStatus: string
  company: string | null
  trackingCode: string | null
  messages: Message[]
  canSend: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const run = (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => startTransition(async () => {
    setNotice(null)
    const result = await work()
    setNotice({ ok: result.ok, text: result.ok ? success : result.error ?? 'عملیات انجام نشد.' })
    router.refresh()
  })

  return (
    <section className="card overflow-hidden" aria-labelledby="order-sms-title">
      <div className="flex items-center justify-between gap-3 bg-surface-sunken px-4 py-3">
        <h2 id="order-sms-title" className="text-sm text-ink-muted">پیامک‌های این سفارش</h2>
        <a href="/admin/sms" className="text-xs text-accent-2 hover:underline">تنظیم قالب‌ها</a>
      </div>
      <div className="divide-y divide-line">
        {messages.filter((m) => !['order_shipped', 'admin_new_order'].includes(m.event)).map((message) => (
          <div key={message.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="text-sm font-medium text-ink">{eventLabels[message.event] ?? message.event}</p><p className="mt-1 text-xs text-ink-muted">{statusLabels[message.status] ?? message.status}{message.last_error ? ` — ${message.last_error}` : ''}</p></div>
            {canSend && !['sent', 'sending', 'cancelled'].includes(message.status) && <button type="button" disabled={pending} onClick={() => run(() => sendOrderSmsAction({ orderId, messageId: message.id }), 'پیامک ارسال شد.')} className="btn btn-secondary btn-sm">{message.status === 'failed' ? 'تلاش دوباره' : 'تأیید و ارسال'}</button>}
          </div>
        ))}
        {messages.filter((m) => !['order_shipped', 'admin_new_order'].includes(m.event)).length === 0 && <p className="p-4 text-sm text-ink-subtle">هنوز پیامک تأیید برای این سفارش در صف قرار نگرفته است.</p>}
        <form className="grid gap-3 p-4 sm:grid-cols-2" action={(formData) => run(() => sendShipmentSmsAction({ orderId, company: String(formData.get('company') ?? ''), trackingCode: String(formData.get('trackingCode') ?? '') }), 'اطلاعات ارسال ذخیره و پیامک رهگیری ارسال شد.')}>
          <div className="sm:col-span-2"><p className="text-sm font-medium text-ink">پیامک رهگیری مرسوله</p><p className="mt-1 text-xs text-ink-muted">اطلاعات ابتدا در سفارش ذخیره می‌شود و پس از ارسال موفق، وضعیت سفارش «ارسال شده» خواهد شد.</p></div>
          <div><label className="label" htmlFor="shipment-company">شرکت حمل</label><input id="shipment-company" name="company" defaultValue={company ?? ''} maxLength={80} required className="field" placeholder="مثلاً پست پیشتاز" /></div>
          <div><label className="label" htmlFor="shipment-tracking">کد رهگیری</label><input id="shipment-tracking" name="trackingCode" defaultValue={trackingCode ?? ''} maxLength={80} required dir="ltr" className="field nums" /></div>
          {canSend && <button type="submit" disabled={pending || !['processing', 'shipped'].includes(orderStatus)} className="btn btn-primary sm:col-span-2">{pending ? 'در حال ارسال…' : messages.some((m) => m.event === 'order_shipped' && m.status === 'failed') ? 'تلاش دوباره برای ارسال' : 'ذخیره و ارسال پیامک رهگیری'}</button>}
        </form>
      </div>
      {notice && <p role="status" className={`border-t border-line px-4 py-3 text-sm ${notice.ok ? 'text-success' : 'text-danger'}`}>{notice.text}</p>}
    </section>
  )
}
