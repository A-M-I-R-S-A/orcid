import Link from 'next/link'

import type { ProductCard as ProductCardData } from '@/modules/catalog/queries'
import { discountPercent } from '@/lib/money'
import { toPersianDigits } from '@/lib/persian'
import { ResponsiveImage } from './media'
import { Rail } from './rail'
import { PriceRange, StarRating } from './ui'

/**
 * Product card.
 *
 * The unit shoppers actually scan, so the details are deliberate:
 *
 *  - A 4:5 frame with a 3px corner. Lingerie is photographed portrait; a
 *    square crop cuts the garment and a 3:4 leaves it floating. The near-square
 *    corner is the catalogue-plate reading — an 18px radius on every tile is
 *    what makes a shop look like a theme rather than a label.
 *  - Name and price sit OUTSIDE the frame. Text on a tinted panel is the
 *    pattern that makes catalogue grids look like stock templates.
 *  - Hover is a slow weighted zoom plus a rule drawn under the name, both on
 *    the same easing, so the card reacts as one object rather than three.
 *  - Out of stock is a legible label on a scrim, not an opacity wash — a
 *    greyed card reads as "broken" rather than "sold out".
 *
 * `priority` is passed true for the first few cards: they are the LCP
 * candidate on a category page, and lazy-loading them delays the very thing
 * the metric measures. §72.
 */
export function ProductCard({
  product,
  priority = false,
  sizes = '(min-width: 1280px) 17rem, (min-width: 768px) 30vw, 45vw',
}: {
  product: ProductCardData
  priority?: boolean
  sizes?: string
}) {
  const percent = product.originalPrice
    ? discountPercent(product.originalPrice, product.minPrice)
    : 0

  return (
    <article className="group/card">
      <Link
        href={`/product/${encodeURIComponent(product.slug)}`}
        className="block rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-2"
      >
        <div className="frame">
          <ResponsiveImage
            path={product.imagePath}
            alt={product.imageAlt ?? product.name}
            width={product.imageWidth}
            height={product.imageHeight}
            sizes={sizes}
            priority={priority}
            seed={product.id}
            className="aspect-[4/5] h-auto w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/card:scale-[1.04]"
          />

          {/*
            Flags sit at the block start — the RIGHT edge in RTL, resolved by
            logical properties rather than a hardcoded side. Squared corners,
            because a pill floating on a photograph is a sticker; a small
            rectangle is a price tag.
          */}
          <div className="absolute top-0 start-0 flex flex-col items-start">
            {percent > 0 && (
              <span className="nums bg-accent px-2.5 py-1.5 text-[11px] font-semibold leading-none text-on-accent">
                {/* Persian writes the sign before the number: ٪۱۵ */}٪
                {toPersianDigits(percent)} تخفیف
              </span>
            )}
            {product.isNewArrival && percent === 0 && (
              <span className="bg-surface/95 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-ink backdrop-blur-sm">
                تازه رسیده
              </span>
            )}
          </div>

          {!product.inStock && (
            <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-ink/55 via-ink/5 to-transparent p-4">
              <span className="bg-surface/95 px-3.5 py-1.5 text-xs font-medium text-ink">
                فعلاً ناموجود
              </span>
            </div>
          )}
        </div>

        <div className="pt-4">
          <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-ink transition-colors duration-300 group-hover/card:text-accent-2 font-[family-name:var(--font-body)]">
            {product.name}
          </h3>

          {product.ratingValue != null && (
            <div className="mt-1.5">
              <StarRating value={product.ratingValue} count={product.ratingCount} />
            </div>
          )}

          {/* A hairline that grows in under the name on hover — the card's one
              moving part besides the image. */}
          <span
            aria-hidden="true"
            className="mt-3 block h-px w-6 bg-line-strong transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/card:w-full group-hover/card:bg-accent-2"
          />

          {/*
            The struck price comes FIRST. Set after the live one it landed on
            the far side of the currency word — "۴۴۹٬۰۰۰ تومان ۵۲۰٬۰۰۰" —
            which reads as two unrelated numbers rather than a price that came
            down. Old, then new, then the unit.
          */}
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            {product.originalPrice && percent > 0 && (
              <s className="nums whitespace-nowrap text-xs text-ink-subtle">
                {toPersianDigits(product.originalPrice.toLocaleString('en-US')).replace(/,/g, '٬')}
              </s>
            )}
            <PriceRange min={product.minPrice} max={product.maxPrice} />
          </div>
        </div>
      </Link>
    </article>
  )
}

/**
 * Grid, for listing pages where the visitor came to browse a whole set and
 * scanning down a column is the point. Homepage sections use the rail below.
 *
 * The grid never has more columns than it has products. A four-column grid
 * holding three of them leaves a column-wide void at the end of the only row
 * on the page, which reads as a layout fault rather than as a short
 * catalogue. Below four the grid also stops stretching, so two products do not
 * become two 600px cards.
 *
 * Class strings are written out in full rather than composed, because Tailwind
 * scans source text and never sees a template-built class name.
 */
const GRID_SHAPE: Record<number, string> = {
  1: 'grid-cols-1 max-w-[26rem]',
  2: 'grid-cols-2 max-w-[54rem]',
  3: 'grid-cols-2 md:grid-cols-3',
}

export function ProductGrid({
  products,
  priorityCount = 4,
  sizes,
}: {
  products: ProductCardData[]
  priorityCount?: number
  sizes?: string
}) {
  const shape =
    GRID_SHAPE[products.length] ?? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'

  return (
    <div className={`grid gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-14 ${shape}`}>
      {products.map((product, i) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={i < priorityCount}
          sizes={sizes}
        />
      ))}
    </div>
  )
}

/**
 * Rail, for homepage shelves.
 *
 * Card widths are set so the next card is always partly visible at every
 * breakpoint — the cut-off edge is what tells a visitor the row moves, now
 * that scrollbars are hidden. At 1280px+ four cards fit and a sliver of the
 * fifth shows past them.
 */
export function ProductRail({
  products,
  label,
  heading,
  aside,
  priorityCount = 0,
}: {
  products: ProductCardData[]
  label: string
  heading: React.ReactNode
  aside?: React.ReactNode
  priorityCount?: number
}) {
  return (
    <Rail label={label} heading={heading} aside={aside}>
      {products.map((product, i) => (
        <div
          key={product.id}
          className="w-[62vw] max-w-[24rem] sm:w-[42vw] md:w-[30vw] lg:w-[23vw] xl:w-[17rem]"
        >
          <ProductCard
            product={product}
            priority={i < priorityCount}
            sizes="(min-width: 1280px) 17rem, (min-width: 1024px) 23vw, (min-width: 768px) 30vw, 62vw"
          />
        </div>
      ))}
    </Rail>
  )
}
