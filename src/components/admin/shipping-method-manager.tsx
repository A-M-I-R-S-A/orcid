'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { deleteShippingMethodAction, saveShippingMethodAction } from '@/modules/admin/shipping-actions'
import type { ShippingMethod } from '@/lib/shipping-config'

export function ShippingMethodManager({ methods }: { methods: ShippingMethod[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  return <section className="card p-6 space-y-5"><div><h2 className="text-lg text-ink">روش‌های ارسال</h2><p className="text-sm text-ink-muted mt-1">یک روش پیش‌فرض تعیین کنید. وقتی بیش از یک روش فعال باشد، مشتری در تسویه‌حساب انتخاب می‌کند.</p></div><div className="space-y-3">{methods.map(method => <MethodForm key={method.id} method={method} onChanged={() => router.refresh()} />)}</div>{adding ? <MethodForm onChanged={() => { setAdding(false); router.refresh() }} /> : <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>روش ارسال جدید</button>}</section>
}

function MethodForm({ method, onChanged }: { method?: ShippingMethod; onChanged: () => void }) {
  const [pending, startTransition] = useTransition(); const [error, setError] = useState<string | null>(null)
  return <form className="rounded-md border border-line p-4 space-y-4" action={form => startTransition(async () => { setError(null); const result = await saveShippingMethodAction({ id: method?.id, name: String(form.get('name') ?? ''), description: String(form.get('description') ?? ''), fee: String(form.get('fee') ?? ''), freeThreshold: String(form.get('freeThreshold') ?? ''), isEnabled: form.get('isEnabled') === 'on', isDefault: form.get('isDefault') === 'on', sortOrder: String(form.get('sortOrder') ?? '0') }); if (result.ok) onChanged(); else setError(result.error) })}>
    <div className="grid sm:grid-cols-2 gap-4"><label className="label">نام<input name="name" className="field mt-1" required defaultValue={method?.name ?? ''} placeholder="مثلاً پست پیشتاز" /></label><label className="label">توضیح<input name="description" className="field mt-1" defaultValue={method?.description ?? ''} placeholder="زمان تقریبی یا توضیح تحویل" /></label><label className="label">هزینه (تومان)<input name="fee" className="field mt-1 nums" dir="ltr" inputMode="numeric" defaultValue={method?.fee ?? 0} /></label><label className="label">خرید رایگان از (تومان)<input name="freeThreshold" className="field mt-1 nums" dir="ltr" inputMode="numeric" defaultValue={method?.freeThreshold ?? 0} /><span className="hint">صفر یعنی غیرفعال</span></label><label className="label">ترتیب نمایش<input name="sortOrder" className="field mt-1 nums" dir="ltr" inputMode="numeric" defaultValue={0} /></label></div>
    <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input name="isEnabled" type="checkbox" defaultChecked={method?.isEnabled ?? true} /> فعال</label><label className="flex items-center gap-2"><input name="isDefault" type="checkbox" defaultChecked={method?.isDefault ?? !method} /> روش پیش‌فرض</label></div>{error && <p className="text-sm text-danger">{error}</p>}<div className="flex gap-3"><button disabled={pending} className="btn btn-primary btn-sm">{pending ? 'در حال ذخیره…' : 'ذخیره روش'}</button>{method && <button type="button" disabled={pending} className="btn btn-ghost btn-sm text-danger" onClick={() => startTransition(async () => { const result = await deleteShippingMethodAction(method.id); if (result.ok) onChanged(); else setError(result.error) })}>حذف</button>}</div>
  </form>
}
