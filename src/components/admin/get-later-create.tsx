'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { createGetLaterDraftAction } from '@/modules/get-later/admin-actions'

export function GetLaterCreate() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="card mb-5 grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        const phone = String(new FormData(event.currentTarget).get('phone') ?? '')
        startTransition(async () => {
          const result = await createGetLaterDraftAction(phone)
          if (!result.ok) {
            setError(result.error)
            return
          }
          router.push(`/admin/get-later/${result.data.cartId}`)
        })
      }}
    >
      <div>
        <label htmlFor="get-later-customer-phone" className="label">موبایل مشتری</label>
        <input id="get-later-customer-phone" name="phone" inputMode="tel" autoComplete="tel" required dir="ltr" className="field nums" placeholder="09121234567" />
        <p className="hint">برای مشتری ثبت‌شده یک پیش‌نویس بسازید، سپس کالاها را با SKU اضافه کنید.</p>
        {error && <p role="alert" className="field-error mt-2">{error}</p>}
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary min-h-11">
        {pending ? 'در حال ساخت…' : 'ساخت پیش‌نویس'}
      </button>
    </form>
  )
}
