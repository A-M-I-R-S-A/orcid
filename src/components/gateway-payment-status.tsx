'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { checkGatewayPaymentAction } from '@/modules/checkout/actions'
import { useSiteText } from '@/components/site-content-provider'

export function GatewayPaymentStatus({ orderId }: { orderId: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const paid = useSiteText('gateway.paid', 'پرداخت با موفقیت تأیید شد.')
  const notPaid = useSiteText('gateway.notPaid', 'پرداخت هنوز از سوی درگاه تأیید نشده است.')
  const checking = useSiteText('gateway.checking', 'در حال بررسی…')
  const check = useSiteText('gateway.check', 'بررسی وضعیت پرداخت')

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
                  ? paid
                  : notPaid,
              )
              router.refresh()
            } else {
              setMessage(result.error)
            }
          })
        }}
      >
        {pending ? checking : check}
      </button>
      {message && <p className="text-xs text-ink-muted">{message}</p>}
    </div>
  )
}
