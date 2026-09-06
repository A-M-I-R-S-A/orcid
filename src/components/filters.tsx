'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { formatAmountLatin } from '@/lib/money'
import { toPersianDigits } from '@/lib/persian'
import type { SearchParams } from '@/lib/validation'

interface Facets {
  colors: { value: string; swatchHex: string | null }[]
  sizes: { value: string }[]
  priceMin: number
  priceMax: number
}

export function FilterBar({
  basePath,
  facets,
  active,
}: {
  basePath: string
  facets: Facets
  active: SearchParams
}) {
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (!sheetOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [sheetOpen])

  const activeCount = [active.color, active.size, active.minPrice, active.inStock].filter(
    Boolean,
  ).length

  const hasFilters = activeCount > 0

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-y border-line py-4 lg:items-start">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="btn btn-secondary btn-sm lg:hidden"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          فیلترها
          {activeCount > 0 && <span className="nums">({toPersianDigits(activeCount)})</span>}
        </button>

        <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-3 lg:flex">
          {facets.colors.length > 0 && (
            <FacetGroup label="رنگ">
              <ColorChips basePath={basePath} facets={facets} active={active} />
            </FacetGroup>
          )}

          {facets.sizes.length > 0 && (
            <FacetGroup label="سایز">
              <SizeChips basePath={basePath} facets={facets} active={active} />
            </FacetGroup>
          )}

          <FacetGroup label="موجودی">
            <StockChip basePath={basePath} active={active} />
          </FacetGroup>

          {hasFilters && (
            <Link href={basePath} className="link-rule shrink-0 text-sm">
              حذف فیلترها
            </Link>
          )}
        </div>

        <SortSelect basePath={basePath} active={active} />
      </div>

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden ${
          sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!sheetOpen}
      >
        <div
          className="absolute inset-0 bg-ink/40"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="فیلترها"
          className={`absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-bg transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            sheetOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-line bg-bg p-5">
            <h2 className="text-lg">فیلترها</h2>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="btn btn-ghost btn-sm"
              tabIndex={sheetOpen ? 0 : -1}
            >
              بستن
            </button>
          </div>

          <div className="space-y-7 p-5 pb-8">
            {facets.colors.length > 0 && (
              <div>
                <p className="label">رنگ</p>
                <ColorChips
                  basePath={basePath}
                  facets={facets}
                  active={active}
                  onNavigate={() => setSheetOpen(false)}
                />
              </div>
            )}

            {facets.sizes.length > 0 && (
              <div>
                <p className="label">سایز</p>
                <SizeChips
                  basePath={basePath}
                  facets={facets}
                  active={active}
                  onNavigate={() => setSheetOpen(false)}
                />
              </div>
            )}

            <div>
              <p className="label">موجودی</p>
              <StockChip
                basePath={basePath}
                active={active}
                onNavigate={() => setSheetOpen(false)}
              />
            </div>

            {facets.priceMax > facets.priceMin && (
              <div>
                <p className="label">محدوده قیمت</p>
                <p className="nums text-sm text-ink-muted">
                  {toPersianDigits(formatAmountLatin(facets.priceMin))} تا{' '}
                  {toPersianDigits(formatAmountLatin(facets.priceMax))} تومان
                </p>
              </div>
            )}

            {hasFilters && (
              <Link
                href={basePath}
                onClick={() => setSheetOpen(false)}
                className="btn btn-secondary btn-block"
              >
                حذف فیلترها
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-s border-line ps-5 first:border-s-0 first:ps-0">
      <span className="shrink-0 text-xs font-medium text-ink-subtle">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function buildHref(
  basePath: string,
  active: SearchParams,
  patch: Record<string, string | undefined>,
) {
  const params = new URLSearchParams()

  const current: Record<string, string | undefined> = {
    sort: active.sort !== 'newest' ? active.sort : undefined,
    color: active.color,
    size: active.size,
    minPrice: active.minPrice ? String(active.minPrice) : undefined,
    maxPrice: active.maxPrice ? String(active.maxPrice) : undefined,
    inStock: active.inStock ? '1' : undefined,
    ...patch,
  }

  for (const [key, value] of Object.entries(current)) {
    if (value) params.set(key, value)
  }

  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

const CHIP_BASE =
  'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-300'
const CHIP_ON = 'border-accent bg-accent text-on-accent'
const CHIP_OFF = 'border-line hover:border-accent-3 hover:text-accent-2'

function ColorChips({
  basePath,
  facets,
  active,
  onNavigate,
}: {
  basePath: string
  facets: Facets
  active: SearchParams
  onNavigate?: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {facets.colors.map((color) => {
        const on = active.color === color.value
        return (
          <Link
            key={color.value}
            href={buildHref(basePath, active, { color: on ? undefined : color.value })}
            onClick={onNavigate}
            aria-pressed={on}
            className={`${CHIP_BASE} ${on ? CHIP_ON : CHIP_OFF}`}
          >
            {color.swatchHex && (
              <span
                className="h-3.5 w-3.5 rounded-full border border-line/60"
                style={{ backgroundColor: color.swatchHex }}
                aria-hidden="true"
              />
            )}
            {color.value}
          </Link>
        )
      })}
    </div>
  )
}

function SizeChips({
  basePath,
  facets,
  active,
  onNavigate,
}: {
  basePath: string
  facets: Facets
  active: SearchParams
  onNavigate?: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {facets.sizes.map((size) => {
        const on = active.size === size.value
        return (
          <Link
            key={size.value}
            href={buildHref(basePath, active, { size: on ? undefined : size.value })}
            onClick={onNavigate}
            aria-pressed={on}
            className={`${CHIP_BASE} nums min-w-[3.25rem] justify-center ${on ? CHIP_ON : CHIP_OFF}`}
          >
            {size.value}
          </Link>
        )
      })}
    </div>
  )
}

function StockChip({
  basePath,
  active,
  onNavigate,
}: {
  basePath: string
  active: SearchParams
  onNavigate?: () => void
}) {
  const on = Boolean(active.inStock)
  return (
    <Link
      href={buildHref(basePath, active, { inStock: on ? undefined : '1' })}
      onClick={onNavigate}
      aria-pressed={on}
      className={`${CHIP_BASE} ${on ? CHIP_ON : CHIP_OFF}`}
    >
      فقط کالاهای موجود
    </Link>
  )
}

function SortSelect({ basePath, active }: { basePath: string; active: SearchParams }) {
  const router = useRouter()

  const options = [
    { value: 'newest', label: 'جدیدترین' },
    { value: 'price_asc', label: 'ارزان‌ترین' },
    { value: 'price_desc', label: 'گران‌ترین' },
    { value: 'popular', label: 'پرفروش‌ترین' },
  ]

  return (
    <div className="flex shrink-0 items-center gap-2">
      <label htmlFor="sort" className="whitespace-nowrap text-xs font-medium text-ink-subtle">
        مرتب‌سازی
      </label>
      <div className="relative">
        <select
          id="sort"
          value={active.sort}
          onChange={(event) => {
            const params = new URLSearchParams()
            if (active.color) params.set('color', active.color)
            if (active.size) params.set('size', active.size)
            if (active.inStock) params.set('inStock', '1')
            if (event.target.value !== 'newest') params.set('sort', event.target.value)

            const query = params.toString()
            router.push(query ? `${basePath}?${query}` : basePath)
          }}
          className="field w-auto appearance-none bg-transparent py-2 pe-9 ps-3 text-sm"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 end-3 my-auto text-ink-subtle"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  )
}
