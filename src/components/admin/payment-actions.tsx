'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { approvePaymentAction, rejectPaymentAction } from '@/modules/admin/actions'

export function PaymentReviewActions({
  paymentId,
  canApprove,
  canReject,
}: {
  paymentId: number
  canApprove: boolean
  canReject: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'idle' | 'confirm' | 'reject'>('idle')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const approve = () => {
    setError(null)
    startTransition(async () => {
      const result = await approvePaymentAction({ paymentId })
      if (result.ok) {
        setMode('idle')
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  const reject = () => {
    setError(null)
    startTransition(async () => {
      const result = await rejectPaymentAction({ paymentId, reason: reason.trim() })
      if (result.ok) {
        setMode('idle')
        setReason('')
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (mode === 'confirm') {
    return (
      <div className="flex flex-col gap-2 min-w-[190px]">
        <p className="text-xs text-ink-muted">
          پرداخت تأیید شود؟ سفارش به وضعیت «پرداخت شده» می‌رود.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={approve}
            disabled={pending}
            className="btn btn-primary btn-sm"
          >
            {pending ? '…' : 'بله، تأیید کن'}
          </button>
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="btn btn-ghost btn-sm"
          >
            انصراف
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  }

  if (mode === 'reject') {
    return (
      <div className="flex flex-col gap-2 min-w-[220px]">
        <label htmlFor={`reason-${paymentId}`} className="sr-only">
          دلیل رد پرداخت
        </label>
        <input
          id={`reason-${paymentId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="دلیل رد (به مشتری نمایش داده می‌شود)"
          className="field py-2 text-xs"
          maxLength={200}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reject}
            disabled={pending || reason.trim().length < 3}
            className="btn btn-sm bg-danger text-white"
          >
            {pending ? '…' : 'رد پرداخت'}
          </button>
          <button type="button" onClick={() => setMode('idle')} className="btn btn-ghost btn-sm">
            انصراف
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      {canApprove && (
        <button type="button" onClick={() => setMode('confirm')} className="btn btn-primary btn-sm">
          تأیید
        </button>
      )}
      {canReject && (
        <button type="button" onClick={() => setMode('reject')} className="btn btn-ghost btn-sm text-danger">
          رد
        </button>
      )}
    </div>
  )
}
