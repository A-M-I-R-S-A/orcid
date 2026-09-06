import Link from 'next/link'

import { AdminEmpty, AdminPagination, Badge, FilterTabs, PageHeader } from '@/components/admin/ui'
import { ReviewModeration } from '@/components/admin/review-moderation'
import { listForAdmin } from '@/modules/reviews/service'
import { requirePermission } from '@/modules/admin/auth'
import { getCurrentAdmin } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { formatJalaliDateTime } from '@/lib/jalali'
import { maskPhone, toPersianDigits } from '@/lib/persian'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'دیدگاه‌ها' }

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  await requirePermission('reviews.view')
  const admin = await getCurrentAdmin()
  const { status = 'pending', page: rawPage } = await searchParams

  const { items, total, page, pageCount } = await listForAdmin({
    status,
    page: Number(rawPage ?? 1) || 1,
  })

  const canModerate = admin ? hasPermission(admin, 'reviews.moderate') : false
  const canReply = admin ? hasPermission(admin, 'reviews.reply') : false
  const canDelete = admin ? hasPermission(admin, 'reviews.delete') : false

  return (
    <>
      <PageHeader title="دیدگاه‌ها" description="بررسی، تأیید و پاسخ به دیدگاه مشتریان" />

      <FilterTabs
        basePath="/admin/reviews"
        current={status}
        options={[
          { value: 'pending', label: 'در انتظار بررسی' },
          { value: 'approved', label: 'تأیید شده' },
          { value: 'rejected', label: 'رد شده' },
          { value: 'hidden', label: 'پنهان' },
          { value: 'all', label: 'همه' },
        ]}
      />

      <p className="text-sm text-ink-muted mb-4 nums">{toPersianDigits(total)} دیدگاه</p>

      {items.length === 0 ? (
        <AdminEmpty title="دیدگاهی یافت نشد" />
      ) : (
        <>
          <ul className="space-y-4">
            {items.map((review) => (
              <li key={review.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <Link
                      href={`/product/${encodeURIComponent(review.productSlug)}#reviews`}
                      target="_blank"
                      rel="noopener"
                      className="text-accent-2 hover:underline font-medium"
                    >
                      {review.productName}
                    </Link>
                    <p className="text-xs text-ink-subtle mt-1">
                      {review.authorName || 'بدون نام'}
                      {' — '}
                      <span className="nums">{maskPhone(review.authorPhone)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {review.isVerifiedPurchase && <Badge tone="positive">خرید تأییدشده</Badge>}
                    <Badge
                      tone={
                        review.status === 'approved'
                          ? 'positive'
                          : review.status === 'pending'
                            ? 'pending'
                            : 'negative'
                      }
                    >
                      {review.status === 'approved'
                        ? 'تأیید شده'
                        : review.status === 'pending'
                          ? 'در انتظار'
                          : review.status === 'hidden'
                            ? 'پنهان'
                            : 'رد شده'}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-accent-2 mb-2">
                  {'★'.repeat(review.rating)}
                  <span className="text-ink-subtle">{'★'.repeat(5 - review.rating)}</span>
                </p>

                {review.title && <p className="font-medium text-ink mb-1">{review.title}</p>}
                <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">
                  {review.body}
                </p>

                {review.replyBody && (
                  <div className="mt-4 ps-4 border-s-2 border-accent-3 bg-surface-sunken/60 rounded-e-lg p-3">
                    <p className="text-xs font-semibold text-accent-2 mb-1">پاسخ ثبت‌شده</p>
                    <p className="text-sm text-ink-muted">{review.replyBody}</p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-line">
                  <time
                    dateTime={review.createdAt.toISOString()}
                    className="text-xs text-ink-subtle nums"
                  >
                    {formatJalaliDateTime(review.createdAt)}
                  </time>

                  <ReviewModeration
                    reviewId={review.id}
                    status={review.status}
                    existingReply={review.replyBody ?? ''}
                    canModerate={canModerate}
                    canReply={canReply}
                    canDelete={canDelete}
                  />
                </div>
              </li>
            ))}
          </ul>

          <AdminPagination
            page={page}
            pageCount={pageCount}
            basePath="/admin/reviews"
            params={{ status }}
          />
        </>
      )}
    </>
  )
}
