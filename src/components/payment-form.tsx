'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { submitPaymentReferenceAction } from '@/modules/checkout/actions'
import { toLatinDigits } from '@/lib/persian'

export function PaymentReferenceForm({ orderId }: { orderId: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)

        startTransition(async () => {
          const result = await submitPaymentReferenceAction({
            orderId,
            referenceCode: value.trim(),
          })

          if (result.ok) {
            router.push(`/account/orders/${orderId}?submitted=1`)
            router.refresh()
          } else {
            setError(result.error)
          }
        })
      }}
    >
      <div>
        <label htmlFor="reference" className="label">
          کد رهگیری / شماره پیگیری پرداخت
        </label>
        <input
          id="reference"
          name="referenceCode"
          type="text"
          inputMode="numeric"
          dir="ltr"
          required
          minLength={4}
          maxLength={64}
          value={value}
          onChange={(event) => setValue(toLatinDigits(event.target.value))}
          className="field text-center nums tracking-wider text-lg"
          placeholder="۱۲۳۴۵۶۷۸"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'reference-error' : 'reference-hint'}
        />
        <p id="reference-hint" className="hint">
          این کد را در پیامک بانک یا تاریخچه تراکنش‌های اپلیکیشن بانکی خود پیدا می‌کنید.
        </p>
      </div>

      {error && (
        <p id="reference-error" role="alert" className="field-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || value.trim().length < 4}
        className="btn btn-primary btn-block py-3.5"
      >
        {pending ? 'در حال ثبت…' : 'ثبت پرداخت'}
      </button>
    </form>
  )
}
