'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { checkGatewayPaymentAdminAction } from '@/modules/admin/actions'

export function AdminGatewayPaymentStatus({ orderId }: { orderId: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="mt-5 border-t border-line pt-4">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={pending}
        onClick={() => {
          setMessage(null)
          startTransition(async () => {
            const result = await checkGatewayPaymentAdminAction({ orderId })
            setMessage(
              result.ok
                ? result.data.paid
                  ? 'پرداخت از درگاه تأیید شد.'
                  : 'درگاه هنوز پرداخت را تأیید نکرده است.'
                : result.error,
            )
            if (result.ok) router.refresh()
          })
        }}
      >
        {pending ? 'در حال استعلام…' : 'استعلام مستقیم از درگاه'}
      </button>
      {message && <p className="mt-2 text-xs text-ink-muted">{message}</p>}
    </div>
  )
}
