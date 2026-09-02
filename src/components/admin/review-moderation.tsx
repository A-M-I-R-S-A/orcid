'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  deleteReviewAction,
  moderateReviewAction,
  replyToReviewAction,
} from '@/modules/admin/actions'

export function ReviewModeration({
  reviewId,
  status,
  existingReply,
  canModerate,
  canReply,
  canDelete,
}: {
  reviewId: number
  status: string
  existingReply: string
  canModerate: boolean
  canReply: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [replying, setReplying] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const moderate = (next: 'approved' | 'rejected' | 'hidden') =>
    startTransition(async () => {
      const result = await moderateReviewAction({ reviewId, status: next })
      if (!result.ok) setError(result.error)
      router.refresh()
    })

  if (replying) {
    return (
      <form
        className="w-full mt-2"
        action={(formData) => {
          setError(null)
          startTransition(async () => {
            const result = await replyToReviewAction({
              reviewId,
              body: String(formData.get('body') ?? ''),
            })
            if (result.ok) {
              setReplying(false)
              router.refresh()
            } else {
              setError(result.error)
            }
          })
        }}
      >
        <label htmlFor={`reply-${reviewId}`} className="sr-only">
          پاسخ به دیدگاه
        </label>
        <textarea
          id={`reply-${reviewId}`}
          name="body"
          rows={3}
          required
          minLength={3}
          defaultValue={existingReply}
          className="field text-sm resize-y"
          placeholder="پاسخ شما در کنار دیدگاه مشتری نمایش داده می‌شود."
        />
        <div className="flex gap-2 mt-2">
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            {pending ? '…' : 'ثبت پاسخ'}
          </button>
          <button type="button" onClick={() => setReplying(false)} className="btn btn-ghost btn-sm">
            انصراف
          </button>
        </div>
        {error && <p className="text-xs text-danger mt-2">{error}</p>}
      </form>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canModerate && status !== 'approved' && (
        <button
          type="button"
          onClick={() => moderate('approved')}
          disabled={pending}
          className="btn btn-primary btn-sm"
        >
          تأیید
        </button>
      )}

      {canModerate && status !== 'rejected' && (
        <button
          type="button"
          onClick={() => moderate('rejected')}
          disabled={pending}
          className="btn btn-ghost btn-sm"
        >
          رد
        </button>
      )}

      {canModerate && status === 'approved' && (
        <button
          type="button"
          onClick={() => moderate('hidden')}
          disabled={pending}
          className="btn btn-ghost btn-sm"
        >
          پنهان
        </button>
      )}

      {canReply && (
        <button type="button" onClick={() => setReplying(true)} className="btn btn-secondary btn-sm">
          {existingReply ? 'ویرایش پاسخ' : 'پاسخ'}
        </button>
      )}

      {canDelete &&
        (confirmDelete ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteReviewAction(reviewId)
                  router.refresh()
                })
              }
              className="btn btn-sm bg-danger text-white"
            >
              حذف قطعی
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="btn btn-ghost btn-sm"
            >
              انصراف
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-danger hover:underline"
          >
            حذف
          </button>
        ))}

      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
