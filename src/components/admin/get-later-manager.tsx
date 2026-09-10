'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  addGetLaterItemAction,
  cancelGetLaterAction,
  openGetLaterAction,
  setGetLaterQuantityAction,
  updateGetLaterDraftAction,
} from '@/modules/get-later/admin-actions'

export function GetLaterAdminManager({
  cart,
}: {
  cart: {
    id: number
    status: 'draft' | 'open' | 'submitted' | 'converted' | 'cancelled'
    adminNote: string | null
    expiresInput: string
    items: { id: number; productName: string; variantLabel: string | null; sku: string; quantity: number; unitPrice: number; decision: 'undecided' | 'pay' | 'return' }[]
  }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const editable = cart.status === 'draft' || cart.status === 'open'
  const detailsEditable = cart.status === 'draft' || cart.status === 'open'

  const run = (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setMessage(null)
    startTransition(async () => {
      const result = await task()
      if (!result.ok) return setMessage({ ok: false, text: result.error ?? 'عملیات انجام نشد.' })
      setMessage({ ok: true, text: success })
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {editable && (
        <form
          className="card grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_9rem_auto] md:items-end"
          action={(formData) => run(
            () => addGetLaterItemAction({ cartId: cart.id, sku: String(formData.get('sku') ?? ''), quantity: Number(formData.get('quantity')) }),
            'کالا اضافه شد.',
          )}
        >
          <div><label htmlFor="sku" className="label">کد تنوع کالا (SKU)</label><input id="sku" name="sku" required className="field nums" dir="ltr" /></div>
          <div><label htmlFor="quantity" className="label">تعداد</label><input id="quantity" name="quantity" type="number" min={1} max={100} defaultValue={1} required className="field nums" /></div>
          <button type="submit" disabled={pending} className="btn btn-primary min-h-11">افزودن کالا</button>
        </form>
      )}

      <section className="card overflow-hidden" aria-labelledby="parcel-items">
        <h2 id="parcel-items" className="border-b border-line p-5 text-lg text-ink">اقلام بسته</h2>
        {cart.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-muted">هنوز کالایی اضافه نشده است.</p>
        ) : (
          <ul className="divide-y divide-line">
            {cart.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                <div>
                  <p className="font-medium text-ink">{item.productName}</p>
                  <p className="nums mt-1 text-xs text-ink-subtle" dir="ltr">{item.sku}</p>
                  {item.variantLabel && <p className="mt-1 text-xs text-ink-muted">{item.variantLabel}</p>}
                </div>
                {editable ? (
                  <form className="flex items-end gap-2" action={(formData) => run(
                    () => setGetLaterQuantityAction({ cartId: cart.id, itemId: item.id, quantity: Number(formData.get('quantity')) }),
                    'تعداد به‌روز شد.',
                  )}>
                    <div><label htmlFor={`qty-${item.id}`} className="label">تعداد (صفر = حذف)</label><input id={`qty-${item.id}`} name="quantity" type="number" min={0} max={100} defaultValue={item.quantity} className="field w-24 nums" /></div>
                    <button type="submit" disabled={pending} className="btn btn-secondary btn-sm min-h-11">ذخیره</button>
                  </form>
                ) : (
                  <span className={`badge ${item.decision === 'pay' ? 'badge-positive' : item.decision === 'return' ? 'badge-accent' : 'badge-pending'}`}>
                    {item.decision === 'pay' ? 'پرداخت' : item.decision === 'return' ? 'بازگشت' : `${item.quantity} عدد • بدون تصمیم`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {detailsEditable && (
        <form className="card grid gap-5 p-5 sm:grid-cols-2" action={(formData) => run(
          () => updateGetLaterDraftAction({ cartId: cart.id, adminNote: String(formData.get('adminNote') ?? ''), expiresAt: String(formData.get('expiresAt') ?? '') }),
          'جزئیات سبد ذخیره شد.',
        )}>
          <div className="sm:col-span-2"><label htmlFor="adminNote" className="label">یادداشت داخلی</label><textarea id="adminNote" name="adminNote" defaultValue={cart.adminNote ?? ''} maxLength={1000} rows={3} className="field resize-y" /></div>
          <div><label htmlFor="expiresAt" className="label">مهلت تصمیم‌گیری</label><input id="expiresAt" name="expiresAt" type="datetime-local" defaultValue={cart.expiresInput} className="field nums" dir="ltr" /></div>
          <div className="flex items-end"><button type="submit" disabled={pending} className="btn btn-secondary min-h-11">ذخیره جزئیات</button></div>
        </form>
      )}

      {(cart.status === 'draft' || cart.status === 'open') && (
        <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-xl text-sm leading-relaxed text-ink-muted">
            {cart.status === 'draft' ? 'با فعال‌سازی، سبد در حساب مشتری دیده می‌شود.' : 'این سبد را مشتری ساخته است؛ موجودی کالاها فقط هنگام «ارسال اکنون» بررسی و کسر می‌شود.'}
          </p>
          <div className="flex gap-2">
            {cart.status === 'draft' && <button type="button" disabled={pending || cart.items.length === 0} onClick={() => run(() => openGetLaterAction(cart.id), 'سبد برای مشتری فعال شد.')} className="btn btn-primary">فعال‌سازی برای مشتری</button>}
            <button type="button" disabled={pending} onClick={() => { if (window.confirm('این سبد لغو شود؟')) run(() => cancelGetLaterAction(cart.id), 'سبد لغو شد.') }} className="btn btn-ghost text-danger">لغو سبد</button>
          </div>
        </div>
      )}

      {message && <p role="status" className={`text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>{message.text}</p>}
    </div>
  )
}
