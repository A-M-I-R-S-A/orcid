'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { setCustomerStatusAction } from '@/modules/admin/customer-actions'

/**
 * Enable / disable a customer account. §43.
 *
 * Disabling asks for a reason and warns that live sessions end immediately —
 * an operator should know the customer will be logged out mid-session, not
 * discover it from a support ticket.
 */
export function CustomerStatusToggle({
  userId,
  isActive,
}: {
  userId: number
  isActive: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const apply = (next: boolean) =>
    startTransition(async () => {
      const result = await setCustomerStatusAction({
        userId,
        isActive: next,
        reason: next ? undefined : reason.trim() || undefined,
      })

      if (result.ok) {
        setConfirming(false)
        setReason('')
        router.refresh()
      } else {
        setError(result.error)
      }
    })

  if (!isActive) {
    return (
      <div className="flex items-center gap-2">
        <span className="badge badge-negative">غیرفعال</span>
        <button
          type="button"
          onClick={() => apply(true)}
          disabled={pending}
          className="text-xs text-accent-2 hover:underline"
        >
          فعال‌سازی
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    )
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <p className="text-xs text-warning">
          نشست‌های فعال این مشتری بلافاصله بسته می‌شود.
        </p>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="دلیل (اختیاری، داخلی)"
          maxLength={200}
          className="field py-1.5 text-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => apply(false)}
            disabled={pending}
            className="btn btn-sm bg-danger text-white"
          >
            {pending ? '…' : 'غیرفعال کن'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="btn btn-ghost btn-sm"
          >
            انصراف
          </button>
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="badge badge-positive">فعال</span>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-danger hover:underline"
      >
        غیرفعال‌سازی
      </button>
    </div>
  )
}
