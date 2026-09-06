'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import type { PublicReview } from '@/modules/reviews/service'
import { submitReviewAction } from '@/modules/reviews/actions'
import { formatJalali } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/persian'

export function ReviewSection({
  productId,
  reviews,
  ownReview,
  isSignedIn,
}: {
  productId: number
  reviews: PublicReview[]
  ownReview: {
    id: number
    rating: number
    title: string | null
    body: string
    status: string
  } | null
  isSignedIn: boolean
}) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">نظر مشتریان</p>
          <h2 className="text-2xl md:text-3xl text-ink">
            دیدگاه‌ها
            {reviews.length > 0 && (
              <span className="text-ink-subtle text-lg nums"> ({toPersianDigits(reviews.length)})</span>
            )}
          </h2>
        </div>

        {isSignedIn ? (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="btn btn-secondary btn-sm"
          >
            {ownReview ? 'ویرایش دیدگاه من' : 'ثبت دیدگاه'}
          </button>
        ) : (
          <Link href="/login" className="btn btn-secondary btn-sm">
            برای ثبت دیدگاه وارد شوید
          </Link>
        )}
      </div>

      {ownReview && ownReview.status === 'pending' && (
        <div className="mb-6 rounded-md bg-warning-bg p-4 text-sm text-warning">
          دیدگاه شما ثبت شد و پس از بررسی و تأیید نمایش داده می‌شود.
        </div>
      )}

      {showForm && isSignedIn && (
        <ReviewForm
          productId={productId}
          existing={ownReview}
          onDone={() => setShowForm(false)}
        />
      )}

      {reviews.length === 0 ? (
        <p className="text-ink-muted py-8">
          هنوز دیدگاهی ثبت نشده است. اولین نفری باشید که نظر می‌دهد.
        </p>
      ) : (
        <ul className="space-y-8 mt-8">
          {reviews.map((review) => (
            <li key={review.id} className="pb-8 border-b border-line last:border-0">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <Stars value={review.rating} />
                <span className="text-sm font-medium text-ink">{review.authorName}</span>
                {review.isVerifiedPurchase && (
                  <span className="badge badge-positive">خرید تأییدشده</span>
                )}
                <time
                  dateTime={review.createdAt.toISOString()}
                  className="text-xs text-ink-subtle nums ms-auto"
                >
                  {formatJalali(review.createdAt)}
                </time>
              </div>

              {review.title && <p className="font-medium text-ink mb-1.5">{review.title}</p>}
              <p className="text-ink-muted leading-relaxed whitespace-pre-line">{review.body}</p>

              {review.reply && (
                <div className="mt-4 ms-4 ps-4 border-s-2 border-accent-3 bg-surface-sunken/60 rounded-e-xl p-4">
                  <p className="text-xs font-semibold text-accent-2 mb-1.5">
                    پاسخ ارکید — {review.reply.authorName}
                  </p>
                  <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">
                    {review.reply.body}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex text-accent-2" aria-label={`${toPersianDigits(value)} از ۵`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width="15"
          height="15"
          viewBox="0 0 20 20"
          fill={i <= value ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <path d="M10 1.8l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 7.6l5.4-.8z" />
        </svg>
      ))}
    </span>
  )
}

function ReviewForm({
  productId,
  existing,
  onDone,
}: {
  productId: number
  existing: { rating: number; title: string | null; body: string } | null
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rating, setRating] = useState(existing?.rating ?? 5)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="card p-6 mb-8 space-y-5"
      action={(formData) => {
        setError(null)
        startTransition(async () => {
          const result = await submitReviewAction({
            productId,
            rating,
            title: String(formData.get('title') ?? ''),
            body: String(formData.get('body') ?? ''),
          })

          if (result.ok) {
            onDone()
            router.refresh()
          } else {
            setError(result.error)
          }
        })
      }}
    >
      <fieldset>
        <legend className="label">امتیاز شما</legend>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-pressed={rating === value}
              aria-label={`${toPersianDigits(value)} ستاره`}
              className="p-1 text-accent-2 transition-transform duration-200 hover:scale-110"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 20 20"
                fill={value <= rating ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.2"
                aria-hidden="true"
              >
                <path d="M10 1.8l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 7.6l5.4-.8z" />
              </svg>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="review-title" className="label">
          عنوان (اختیاری)
        </label>
        <input
          id="review-title"
          name="title"
          type="text"
          maxLength={160}
          defaultValue={existing?.title ?? ''}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="review-body" className="label">
          متن دیدگاه
        </label>
        <textarea
          id="review-body"
          name="body"
          rows={5}
          required
          minLength={10}
          maxLength={2000}
          defaultValue={existing?.body ?? ''}
          className="field resize-y"
          placeholder="تجربه خود را از این محصول بنویسید…"
        />
        <p className="hint">دیدگاه شما پس از بررسی توسط تیم ارکید منتشر می‌شود.</p>
      </div>

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? 'در حال ثبت…' : existing ? 'به‌روزرسانی دیدگاه' : 'ثبت دیدگاه'}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost">
          انصراف
        </button>
      </div>
    </form>
  )
}
