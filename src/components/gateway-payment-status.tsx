'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { checkGatewayPaymentAction } from '@/modules/checkout/actions'

export function GatewayPaymentStatus({ orderId }: { orderId: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={pending}
        onClick={() => {
          setMessage(null)
          startTransition(async () => {
            const result = await checkGatewayPaymentAction({ orderId })
            if (result.ok) {
              setMessage(
                result.data.paid
                  ? 'پرداخت با موفقیت تأیید شد.'
                  : 'پرداخت هنوز از سوی درگاه تأیید نشده است.',
              )
              router.refresh()
            } else {
              setMessage(result.error)
            }
          })
        }}
      >
        {pending ? 'در حال بررسی…' : 'بررسی وضعیت پرداخت'}
      </button>
      {message && <p className="text-xs text-ink-muted">{message}</p>}
    </div>
  )
}
