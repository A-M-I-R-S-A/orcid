import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'

import type { ProductCard as ProductCardData } from '@/modules/catalog/queries'
import { discountPercent } from '@/lib/money'
import { toPersianDigits } from '@/lib/persian'
import { ResponsiveImage } from './media'
import { Rail } from './rail'
import { WishlistButton } from './wishlist-button'
import { PriceRange, StarRating } from './ui'
import { useSiteText } from './site-content-provider'

export function ProductCard({
  product,
  priority = false,
  saved = false,
  sizes = '(min-width: 1280px) 17rem, (min-width: 768px) 30vw, 45vw',
}: {
  product: ProductCardData
  priority?: boolean
  saved?: boolean
  sizes?: string
}) {
  const newLabel = useSiteText('product.new', 'تازه رسیده')
  const unavailableLabel = useSiteText('product.outOfStock', 'فعلاً ناموجود')
  const percent = product.originalPrice
    ? discountPercent(product.originalPrice, product.minPrice)
    : 0

  return (
    <article className="group/card relative">
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

          <div className="absolute top-0 start-0 flex flex-col items-start">
            {percent > 0 && (
              <span className="nums border-b border-s border-line bg-bg/90 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-accent backdrop-blur-sm">
                ٪
                {toPersianDigits(percent)}−
              </span>
            )}
            {product.isNewArrival && percent === 0 && (
              <span className="border-b border-s border-line bg-bg/90 px-2.5 py-1.5 text-[11px] font-medium leading-none text-ink backdrop-blur-sm">
                <SiteStyledText contentKey="product.new">{newLabel}</SiteStyledText>
              </span>
            )}
          </div>

          {!product.inStock && (
            <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-ink/55 via-ink/5 to-transparent p-4">
              <span className="bg-surface/95 px-3.5 py-1.5 text-xs font-medium text-ink">
                <SiteStyledText contentKey="product.outOfStock">{unavailableLabel}</SiteStyledText>
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

          <span
            aria-hidden="true"
            className="mt-3 block h-px w-6 bg-line-strong transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/card:w-full group-hover/card:bg-accent-2"
          />

          <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            {product.originalPrice && percent > 0 && (
              <s className="nums whitespace-nowrap text-xs text-ink-muted">
                {toPersianDigits(product.originalPrice.toLocaleString('en-US')).replace(/,/g, '٬')}
              </s>
            )}
            <PriceRange min={product.minPrice} max={product.maxPrice} />
          </div>
        </div>
      </Link>

      <div
        className={`absolute top-2.5 end-2.5 transition-opacity duration-300 ${
          saved
            ? ''
            : '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:opacity-100 [@media(hover:hover)]:group-focus-within/card:opacity-100'
        }`}
      >
        <WishlistButton
          productId={product.id}
          productName={product.name}
          initialSaved={saved}
          size="sm"
        />
      </div>
    </article>
  )
}

const GRID_SHAPE: Record<number, string> = {
  1: 'grid-cols-1 max-w-[26rem]',
  2: 'grid-cols-2 max-w-[54rem]',
  3: 'grid-cols-2 md:grid-cols-3',
}

export function ProductGrid({
  products,
  priorityCount = 4,
  savedIds,
  sizes,
}: {
  products: ProductCardData[]
  priorityCount?: number
  savedIds?: Set<number>
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
          saved={savedIds?.has(product.id) ?? false}
          sizes={sizes}
        />
      ))}
    </div>
  )
}

export function ProductRail({
  products,
  label,
  title,
  subtitle,
  action,
  savedIds,
  priorityCount = 0,
}: {
  products: ProductCardData[]
  label: string
  title: string
  subtitle?: string | null
  action?: { label: string; href: string }
  savedIds?: Set<number>
  priorityCount?: number
}) {
  return (
    <Rail label={label} title={title} subtitle={subtitle} action={action}>
      {products.map((product, i) => (
        <div
          key={product.id}
          className="w-[62vw] max-w-[24rem] sm:w-[42vw] md:w-[30vw] lg:w-[23vw] xl:w-[17rem]"
        >
          <ProductCard
            product={product}
            priority={i < priorityCount}
            saved={savedIds?.has(product.id) ?? false}
            sizes="(min-width: 1280px) 17rem, (min-width: 1024px) 23vw, (min-width: 768px) 30vw, 62vw"
          />
        </div>
      ))}
    </Rail>
  )
}
