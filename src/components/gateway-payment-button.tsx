'use client'

import { useState, useTransition } from 'react'

import { startGatewayPaymentAction } from '@/modules/checkout/actions'
import { useSiteText } from '@/components/site-content-provider'

export function GatewayPaymentButton({
  orderId,
  label,
}: {
  orderId: number
  label: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const connecting = useSiteText('gateway.connecting', 'در حال اتصال به درگاه…')

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="btn btn-primary btn-block py-4"
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await startGatewayPaymentAction({ orderId })
            if (!result.ok) {
              setError(result.error)
              return
            }
            window.location.assign(result.data.redirectUrl)
          })
        }}
      >
        {pending ? connecting : label}
      </button>
      {error && (
        <p role="alert" className="rounded-md bg-danger-bg p-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
