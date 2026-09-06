import Link from 'next/link'

import { EmptyState } from '@/components/ui'
import { listOwnReviews } from '@/modules/reviews/service'
import { requireUser } from '@/lib/session'
import { formatJalali } from '@/lib/jalali'

export const metadata = { title: 'دیدگاه‌های من' }

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'در انتظار تأیید', tone: 'badge-pending' },
  approved: { label: 'منتشر شده', tone: 'badge-positive' },
  rejected: { label: 'تأیید نشد', tone: 'badge-negative' },
  hidden: { label: 'پنهان شده', tone: 'badge-neutral' },
}

export default async function MyReviewsPage() {
  const user = await requireUser()
  const reviews = await listOwnReviews(user.id)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl md:text-3xl text-ink">دیدگاه‌های من</h1>

      {reviews.length === 0 ? (
        <EmptyState
          title="هنوز دیدگاهی ثبت نکرده‌اید"
          description="پس از خرید، تجربه خود را با دیگران به اشتراک بگذارید."
          action={{ label: 'مشاهده محصولات', href: '/' }}
        />
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => {
            const status = STATUS_LABELS[review.status] ?? STATUS_LABELS.pending!

            return (
              <li key={review.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <Link
                    href={`/product/${encodeURIComponent(review.productSlug)}#reviews`}
                    className="font-medium text-ink hover:text-accent-2 transition-colors"
                  >
                    {review.productName}
                  </Link>
                  <span className={`badge ${status.tone}`}>{status.label}</span>
                </div>

                <p className="text-sm text-accent-2 nums mb-2">
                  {'★'.repeat(review.rating)}
                  <span className="text-ink-subtle">{'★'.repeat(5 - review.rating)}</span>
                </p>

                {review.title && <p className="font-medium text-ink mb-1">{review.title}</p>}
                <p className="text-sm text-ink-muted leading-relaxed">{review.body}</p>

                <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-line">
                  <time
                    dateTime={review.createdAt.toISOString()}
                    className="text-xs text-ink-subtle nums"
                  >
                    {formatJalali(review.createdAt)}
                  </time>
                  <Link
                    href={`/product/${encodeURIComponent(review.productSlug)}#reviews`}
                    className="text-xs text-accent-2 hover:underline"
                  >
                    ویرایش دیدگاه
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
