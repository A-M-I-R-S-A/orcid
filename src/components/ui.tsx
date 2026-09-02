import Link from 'next/link'

import { CURRENCY_LABEL, formatPrice } from '@/lib/money'
import { toPersianDigits as faDigits } from '@/lib/persian'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, type OrderStatus } from '@/lib/order-status'
import { OrchidBloom } from './ornament'

/* ── Price ──────────────────────────────────────────────────────────────── */

/**
 * Prices always render through here, so the currency label, Persian numerals
 * and the discount presentation stay identical everywhere they appear.
 *
 * The unit is set smaller and muted, and never wraps away from its number.
 * "۴۴۹٬۰۰۰ تومان" at one weight makes the amount and the word compete; the
 * amount is what a shopper compares, so it gets the weight on its own.
 */
export function Price({
  amount,
  original,
  size = 'md',
  className,
}: {
  amount: number
  original?: number | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl',
  }

  const discounted = original != null && original > amount

  return (
    <span className={`nums inline-flex items-baseline gap-2 whitespace-nowrap ${className ?? ''}`}>
      {discounted && (
        <s className="text-sm text-ink-subtle" aria-label="قیمت پیشین">
          {formatPrice(original, false)}
        </s>
      )}
      <strong className={`${sizes[size]} font-semibold text-ink`}>
        {formatPrice(amount, false)}
      </strong>
      <span className="text-[0.72em] font-normal text-ink-muted">{CURRENCY_LABEL}</span>
    </span>
  )
}

export function PriceRange({ min, max }: { min: number; max: number }) {
  if (min === max) return <Price amount={min} />
  return (
    <span className="nums inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <strong className="font-semibold text-ink">{formatPrice(min, false)}</strong>
      <span aria-hidden="true" className="text-ink-subtle">
        –
      </span>
      <strong className="font-semibold text-ink">{formatPrice(max, false)}</strong>
      <span className="text-[0.72em] font-normal text-ink-muted">{CURRENCY_LABEL}</span>
    </span>
  )
}

export function DiscountBadge({ percent }: { percent: number }) {
  if (percent <= 0) return null
  return (
    <span className="badge badge-accent nums" aria-label={`${percent} درصد تخفیف`}>
      ٪{faDigits(percent)}
    </span>
  )
}

/* ── Rating ─────────────────────────────────────────────────────────────── */

/**
 * §62: `value` of null renders nothing at all rather than an empty five-star
 * row. A product with no reviews must not look like a product rated zero.
 */
export function StarRating({
  value,
  count,
  size = 'sm',
}: {
  value: number | null
  count?: number
  size?: 'sm' | 'md'
}) {
  if (value == null) return null

  const rounded = Math.round(value * 2) / 2
  const dimension = size === 'sm' ? 14 : 18

  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`امتیاز ${faDigits(value.toFixed(1))} از ۵`}
    >
      <span className="inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            width={dimension}
            height={dimension}
            viewBox="0 0 20 20"
            fill={i <= rounded ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.2"
            className="text-accent-2"
          >
            <path d="M10 1.8l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 7.6l5.4-.8z" />
          </svg>
        ))}
      </span>
      {count != null && count > 0 && (
        <span className="text-xs text-ink-subtle nums">({faDigits(count)})</span>
      )}
    </span>
  )
}

/* ── Status ─────────────────────────────────────────────────────────────── */

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = ORDER_STATUS_TONE[status]
  return <span className={`badge badge-${tone}`}>{ORDER_STATUS_LABELS[status]}</span>
}

/* ── Breadcrumbs ────────────────────────────────────────────────────────── */

/**
 * Breadcrumbs reinforce the hierarchy for both readers and crawlers (§71).
 * The matching BreadcrumbList JSON-LD is emitted by the page, from the same
 * array — so the visible trail and the structured data cannot disagree.
 */
export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="مسیر صفحه" className="text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={item.path} className="flex items-center gap-2">
              {isLast ? (
                <span aria-current="page" className="text-ink">
                  {item.name}
                </span>
              ) : (
                <Link href={item.path} className="hover:text-accent-2 transition-colors">
                  {item.name}
                </Link>
              )}
              {!isLast && (
                <span aria-hidden="true" className="text-ink-subtle">
                  ›
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ── Pagination ─────────────────────────────────────────────────────────── */

/**
 * Real <a> links, not buttons — paginated pages must be crawlable and
 * shareable. §67: page 2+ self-canonicalises and stays indexable, so these
 * links carry real SEO weight.
 */
export function Pagination({
  page,
  pageCount,
  basePath,
  searchParams,
}: {
  page: number
  pageCount: number
  basePath: string
  searchParams?: Record<string, string | undefined>
}) {
  if (pageCount <= 1) return null

  const href = (target: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value) params.set(key, value)
    }
    if (target > 1) params.set('page', String(target))
    const query = params.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  // A window around the current page, so 200 pages do not render 200 links.
  const pages: number[] = []
  const from = Math.max(1, page - 2)
  const to = Math.min(pageCount, page + 2)
  for (let i = from; i <= to; i++) pages.push(i)

  return (
    <nav aria-label="صفحه‌بندی" className="flex items-center justify-center gap-2 pt-8">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className="btn btn-ghost btn-sm">
          <span aria-hidden="true" className="mirror-rtl">
            ←
          </span>
          قبلی
        </Link>
      )}

      {from > 1 && (
        <>
          <Link href={href(1)} className="btn btn-ghost btn-sm nums">
            ۱
          </Link>
          {from > 2 && <span className="text-ink-subtle px-1">…</span>}
        </>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? 'page' : undefined}
          className={`btn btn-sm nums ${p === page ? 'btn-primary' : 'btn-ghost'}`}
        >
          {faDigits(p)}
        </Link>
      ))}

      {to < pageCount && (
        <>
          {to < pageCount - 1 && <span className="text-ink-subtle px-1">…</span>}
          <Link href={href(pageCount)} className="btn btn-ghost btn-sm nums">
            {faDigits(pageCount)}
          </Link>
        </>
      )}

      {page < pageCount && (
        <Link href={href(page + 1)} rel="next" className="btn btn-ghost btn-sm">
          بعدی
          <span aria-hidden="true" className="mirror-rtl">
            →
          </span>
        </Link>
      )}
    </nav>
  )
}

/* ── Section heading ────────────────────────────────────────────────────── */

/**
 * The text half of a section heading, on its own so a rail can hand it to the
 * client component that owns the scroll controls without dragging the copy
 * across the server/client boundary.
 */
export function SectionTitleBlock({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string
  title: string
  subtitle?: string | null
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="section-title">{title}</h2>
      {subtitle && <p className="mt-3 leading-relaxed text-ink-muted">{subtitle}</p>}
    </div>
  )
}

/**
 * "See all" and its relatives. A text link with a rule rather than a button:
 * a pill beside every section heading puts a second competing weight into
 * every section on the page, and there are five of them on the homepage.
 */
export function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="link-rule shrink-0">
      {label}
      <span aria-hidden="true" className="mirror-rtl">
        →
      </span>
    </Link>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string
  title: string
  subtitle?: string | null
  action?: { label: string; href: string }
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10">
      <SectionTitleBlock eyebrow={eyebrow} title={title} subtitle={subtitle} />
      {action && <SectionLink href={action.href} label={action.label} />}
    </div>
  )
}

/* ── Empty state ────────────────────────────────────────────────────────── */

/**
 * Empty state.
 *
 * An empty screen is an invitation to act, so the action is the point and the
 * panel is only there to hold it. Bounded rather than full-bleed: a 1300px
 * band of blank surface with one small sentence in the middle of it reads as
 * a page that failed to load.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="card mx-auto max-w-xl px-6 py-14 text-center">
      <OrchidBloom className="mx-auto mb-5 h-8 w-8 text-accent-3" />
      <h3 className="mb-2 text-xl text-ink">{title}</h3>
      {description && (
        <p className="mx-auto max-w-md leading-relaxed text-ink-muted">{description}</p>
      )}
      {action && (
        <Link href={action.href} className="btn btn-primary mt-7">
          {action.label}
        </Link>
      )}
    </div>
  )
}

/* ── Alert ──────────────────────────────────────────────────────────────── */

export function Alert({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: 'neutral' | 'positive' | 'pending' | 'negative'
  title?: string
  children: React.ReactNode
}) {
  const tones = {
    neutral: 'bg-surface-sunken text-ink',
    positive: 'bg-success-bg text-success',
    pending: 'bg-warning-bg text-warning',
    negative: 'bg-danger-bg text-danger',
  }

  return (
    <div className={`rounded-md p-4 ${tones[tone]}`} role={tone === 'negative' ? 'alert' : undefined}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  )
}
