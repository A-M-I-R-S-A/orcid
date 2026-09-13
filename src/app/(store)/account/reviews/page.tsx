import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'

import { EmptyState } from '@/components/ui'
import { listOwnReviews } from '@/modules/reviews/service'
import { requireUser } from '@/lib/session'
import { formatJalali } from '@/lib/jalali'
import { getSiteContent } from '@/lib/site-content'

export async function generateMetadata() { const content = await getSiteContent(); return { title: content.text('reviews.mine') } }

export default async function MyReviewsPage() {
  const user = await requireUser()
  const reviews = await listOwnReviews(user.id)
  const content = await getSiteContent()
  const statusLabels: Record<string, { label: string; tone: string }> = {
    pending: { label: content.text('reviews.pending'), tone: 'badge-pending' },
    approved: { label: content.text('reviews.published'), tone: 'badge-positive' },
    rejected: { label: content.text('reviews.rejected'), tone: 'badge-negative' },
    hidden: { label: content.text('reviews.hidden'), tone: 'badge-neutral' },
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl md:text-3xl text-ink"><SiteStyledText contentKey="reviews.mine">{content.text('reviews.mine')}</SiteStyledText></h1>

      {reviews.length === 0 ? (
        <EmptyState
          title={content.text('reviews.empty')}
          description={content.text('reviews.emptyDescription')}
          action={{ label: content.text('common.viewProducts'), href: '/' }}
        />
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => {
            const status = statusLabels[review.status] ?? statusLabels.pending!

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
                    <SiteStyledText contentKey="reviews.edit">{content.text('reviews.edit')}</SiteStyledText>
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
