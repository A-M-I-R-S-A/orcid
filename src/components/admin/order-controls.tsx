'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { addOrderNoteAction, updateOrderStatusAction } from '@/modules/admin/actions'
import type { OrderStatus } from '@/lib/order-status'

export function OrderStatusControl({
  orderId,
  options,
}: {
  orderId: number
  options: { value: OrderStatus; label: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<OrderStatus | ''>('')
  const [error, setError] = useState<string | null>(null)

  const apply = () => {
    if (!selected) return
    setError(null)

    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId, status: selected })
      if (result.ok) {
        setSelected('')
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      <label htmlFor="next-status" className="sr-only">
        وضعیت جدید
      </label>
      <select
        id="next-status"
        value={selected}
        onChange={(event) => setSelected(event.target.value as OrderStatus)}
        className="field py-2.5 text-sm"
      >
        <option value="">انتخاب وضعیت جدید…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {selected === 'cancelled' && (
        <p className="text-xs text-warning bg-warning-bg rounded-lg p-2.5">
          با لغو سفارش، موجودی اقلام به انبار بازگردانده می‌شود.
        </p>
      )}

      <button
        type="button"
        onClick={apply}
        disabled={pending || !selected}
        className="btn btn-primary btn-sm btn-block"
      >
        {pending ? 'در حال اعمال…' : 'اعمال تغییر'}
      </button>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

export function OrderNoteForm({ orderId, current }: { orderId: number; current: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState(current)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        setSaved(false)

        startTransition(async () => {
          const result = await addOrderNoteAction({ orderId, note })
          if (result.ok) {
            setSaved(true)
            router.refresh()
          } else {
            setError(result.error)
          }
        })
      }}
    >
      <label htmlFor="internal-note" className="sr-only">
        یادداشت داخلی
      </label>
      <textarea
        id="internal-note"
        value={note}
        onChange={(event) => {
          setNote(event.target.value)
          setSaved(false)
        }}
        rows={4}
        maxLength={2000}
        className="field text-sm resize-y"
        placeholder="مثلاً: تماس گرفته شد، مشتری تأیید کرد."
      />

      <button type="submit" disabled={pending} className="btn btn-secondary btn-sm btn-block">
        {pending ? 'در حال ذخیره…' : 'ذخیره یادداشت'}
      </button>

      {saved && <p className="text-xs text-success">یادداشت ذخیره شد.</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  )
}
