'use client'

import { SiteStyledText } from '@/components/site-content-provider'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { submitPaymentReferenceAction } from '@/modules/checkout/actions'
import { toLatinDigits } from '@/lib/persian'
import { useSiteText } from '@/components/site-content-provider'

export function PaymentReferenceForm({ orderId }: { orderId: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const referenceLabel = useSiteText('payment.referenceLabel', 'کد رهگیری / شماره پیگیری پرداخت')
  const referenceHint = useSiteText('payment.referenceHint', 'این کد را در پیامک بانک یا تاریخچه تراکنش‌های اپلیکیشن بانکی خود پیدا می‌کنید.')
  const submitting = useSiteText('payment.submitting', 'در حال ثبت…')
  const submit = useSiteText('payment.submit', 'ثبت پرداخت')

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
          <SiteStyledText contentKey="payment.referenceLabel">{referenceLabel}</SiteStyledText>
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
          <SiteStyledText contentKey="payment.referenceHint">{referenceHint}</SiteStyledText>
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
        {pending ? submitting : submit}
      </button>
    </form>
  )
}
