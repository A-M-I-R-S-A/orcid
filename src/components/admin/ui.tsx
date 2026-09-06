import Link from 'next/link'

import { formatPrice } from '@/lib/money'
import { toPersianDigits } from '@/lib/persian'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
      <div>
        <h1 className="text-2xl text-ink">{title}</h1>
        {description && <p className="text-sm text-ink-muted mt-1.5">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  href,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  hint?: string
  href?: string
  tone?: 'neutral' | 'positive' | 'pending' | 'negative'
}) {
  const tones = {
    neutral: 'border-line',
    positive: 'border-success/30 bg-success-bg/40',
    pending: 'border-warning/40 bg-warning-bg/50',
    negative: 'border-danger/30 bg-danger-bg/40',
  }

  const body = (
    <div
      className={`card p-5 h-full transition-colors ${tones[tone]} ${
        href ? 'hover:border-accent-3' : ''
      }`}
    >
      <p className="text-xs text-ink-muted mb-2">{label}</p>
      <p className="text-2xl text-ink nums">
        {typeof value === 'number' ? toPersianDigits(value) : value}
      </p>
      {hint && <p className="text-xs text-ink-subtle mt-1.5">{hint}</p>}
    </div>
  )

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  )
}

export function MoneyTile({ label, amount, hint }: { label: string; amount: number; hint?: string }) {
  return (
    <div className="card p-5 h-full">
      <p className="text-xs text-ink-muted mb-2">{label}</p>
      <p className="text-xl text-ink nums">{formatPrice(amount)}</p>
      {hint && <p className="text-xs text-ink-subtle mt-1.5">{hint}</p>}
    </div>
  )
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-sm min-w-[640px]">{children}</table>
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`text-start px-4 py-3 text-xs font-medium text-ink-muted bg-surface-sunken whitespace-nowrap ${className ?? ''}`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
  title,
  colSpan,
}: {
  children?: React.ReactNode
  className?: string
  title?: string
  colSpan?: number
}) {
  return (
    <td
      className={`px-4 py-3 border-t border-line align-middle ${className ?? ''}`}
      title={title}
      colSpan={colSpan}
    >
      {children}
    </td>
  )
}

export function AdminEmpty({ title, description }: { title: string; description?: string }) {
  return (
    <div className="card py-14 px-6 text-center">
      <p className="text-ink font-medium">{title}</p>
      {description && <p className="text-sm text-ink-muted mt-1.5">{description}</p>}
    </div>
  )
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'positive' | 'pending' | 'negative' | 'accent'
  children: React.ReactNode
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function FilterTabs({
  basePath,
  current,
  options,
}: {
  basePath: string
  current: string
  options: { value: string; label: string; count?: number }[]
}) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-5">
      {options.map((option) => {
        const active = current === option.value
        return (
          <Link
            key={option.value}
            href={option.value === 'all' ? basePath : `${basePath}?status=${option.value}`}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 px-4 py-2 rounded-full text-sm border transition-colors ${
              active ? 'bg-accent text-on-accent border-accent' : 'border-line hover:border-accent-3'
            }`}
          >
            {option.label}
            {option.count != null && option.count > 0 && (
              <span className="nums opacity-75"> ({toPersianDigits(option.count)})</span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

export function AdminPagination({
  page,
  pageCount,
  basePath,
  params,
}: {
  page: number
  pageCount: number
  basePath: string
  params?: Record<string, string | undefined>
}) {
  if (pageCount <= 1) return null

  const href = (target: number) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) search.set(key, value)
    }
    if (target > 1) search.set('page', String(target))
    const query = search.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  return (
    <div className="flex items-center justify-between gap-4 mt-5">
      <p className="text-sm text-ink-muted nums">
        صفحه {toPersianDigits(page)} از {toPersianDigits(pageCount)}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className="btn btn-ghost btn-sm">
            قبلی
          </Link>
        )}
        {page < pageCount && (
          <Link href={href(page + 1)} className="btn btn-ghost btn-sm">
            بعدی
          </Link>
        )}
      </div>
    </div>
  )
}
