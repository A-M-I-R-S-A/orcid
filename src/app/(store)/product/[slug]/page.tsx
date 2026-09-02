import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'

import { ProductGallery, ProductPurchasePanel } from '@/components/product-detail'
import { ProductGrid } from '@/components/product-card'
import { Breadcrumbs, SectionHeading, StarRating } from '@/components/ui'
import { ReviewSection } from '@/components/reviews'
import {
  categoryTrail,
  findSlugRedirect,
  getProductBySlug,
  relatedProducts,
} from '@/modules/catalog/queries'
import * as reviewService from '@/modules/reviews/service'
import { getCurrentUser } from '@/lib/session'
import { getNamespace } from '@/lib/settings'
import {
  breadcrumbSchema,
  buildMetadata,
  jsonLd,
  productSchema,
  shouldIndex,
} from '@/lib/seo'

/**
 * Product page. §17 / §63.
 *
 * Everything a search engine needs — name, description, price, availability,
 * breadcrumbs, reviews, structured data — is rendered on the server. The only
 * client JavaScript is the gallery and variant picker, and the page is
 * complete and purchasable-looking without it.
 */
export const revalidate = 600

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * Resolves the slug, following a rename through the redirect table.
 * Returning the redirect rather than 404ing is what §66 asks for — a renamed
 * product must not lose the links pointing at it.
 */
async function resolve(rawSlug: string) {
  const slug = decodeURIComponent(rawSlug)
  const product = await getProductBySlug(slug)

  if (product) return { product, slug }

  const redirectTo = await findSlugRedirect('product', slug)
  if (redirectTo) permanentRedirect(`/product/${encodeURIComponent(redirectTo)}`)

  return { product: null, slug }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(decodeURIComponent(slug))

  if (!product) {
    return { title: 'محصول یافت نشد', robots: { index: false, follow: false } }
  }

  const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0]

  return buildMetadata({
    title: product.seoTitle || product.name,
    description: product.seoDescription || product.shortDescription,
    path: `/product/${encodeURIComponent(product.slug)}`,
    imagePath: primaryImage?.path,
    // Archived and inactive products are excluded by the same predicate the
    // sitemap uses, so the two can never disagree. §H.
    index: shouldIndex(product),
    type: 'product',
  })
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const { product } = await resolve(slug)

  if (!product) notFound()

  /*
   * Archived and inactive products both return 404.
   *
   * §74 asks for 410 on permanently withdrawn products, and the planning
   * package said we would emit it. We do not, for a concrete framework reason:
   * an App Router *page* cannot set an arbitrary HTTP status — `notFound()`
   * gives 404 and there is no `gone()`. Emitting a real 410 would require
   * either Node-runtime middleware (not stable in this Next version) or a
   * database lookup in edge middleware on every request, which is a poor trade
   * on shared hosting.
   *
   * The practical cost is small: Google treats 404 and 410 almost identically,
   * 410 only de-indexing marginally faster. What matters more is handled —
   * archived products are excluded from the sitemap and marked noindex by the
   * same `shouldIndex` predicate, so they leave the index either way.
   */
  if (product.isArchived || !product.isActive) notFound()

  const [trail, related, reviews, user] = await Promise.all([
    product.primaryCategoryId ? categoryTrail(product.primaryCategoryId) : Promise.resolve([]),
    relatedProducts(product.id, product.primaryCategoryId, 4),
    reviewService.listForProduct(product.id),
    getCurrentUser(),
  ])

  const ownReview = user ? await reviewService.getOwnReview(user.id, product.id) : null

  const breadcrumbItems = [
    { name: 'خانه', path: '/' },
    ...trail.map((c) => ({ name: c.name, path: `/category/${encodeURIComponent(c.slug)}` })),
    { name: product.name, path: `/product/${encodeURIComponent(product.slug)}` },
  ]

  const inStock = product.variants.some((v) => v.isActive && v.stockQty > 0)
  const prices = product.variants.filter((v) => v.isActive).map((v) => v.effectivePrice)
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0

  const ratingValue = product.ratingCount > 0 ? product.ratingSum / product.ratingCount : undefined

  const schemas = [
    productSchema({
      name: product.name,
      description: product.shortDescription || product.description,
      slug: product.slug,
      sku: product.variants[0]?.sku,
      images: product.images.map((i) => i.path),
      price: minPrice,
      inStock,
      // §62: passed only when approved reviews actually exist. productSchema
      // omits AggregateRating entirely when the count is zero.
      ratingValue,
      ratingCount: product.ratingCount,
    }),
    breadcrumbSchema(breadcrumbItems),
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }}
      />

      <div className="container-page py-6">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <div className="container-page pb-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16">
          <ProductGallery images={product.images} productName={product.name} />

          <div className="lg:py-4">
            {product.category && (
              <Link
                href={`/category/${encodeURIComponent(product.category.slug)}`}
                className="eyebrow hover:text-accent-2 transition-colors"
              >
                {product.category.name}
              </Link>
            )}

            <h1 className="mt-3 text-3xl md:text-4xl text-ink leading-[1.5]">{product.name}</h1>

            {product.ratingCount > 0 && (
              <div className="mt-4">
                <a href="#reviews" className="inline-block">
                  <StarRating value={ratingValue!} count={product.ratingCount} size="md" />
                </a>
              </div>
            )}

            {product.shortDescription && (
              <p className="mt-5 text-ink-muted leading-relaxed">{product.shortDescription}</p>
            )}

            <div className="mt-8">
              <ProductPurchasePanel product={product} />
            </div>
          </div>
        </div>

        {product.description && (
          <section className="mt-20 pt-12 border-t border-line" aria-labelledby="description">
            <h2 id="description" className="text-2xl text-ink mb-6">
              توضیحات محصول
            </h2>
            <div className="prose text-ink-muted whitespace-pre-line">{product.description}</div>
          </section>
        )}

        <section id="reviews" className="mt-20 pt-12 border-t border-line">
          <ReviewSection
            productId={product.id}
            reviews={reviews}
            ownReview={
              ownReview
                ? {
                    id: ownReview.id,
                    rating: ownReview.rating,
                    title: ownReview.title,
                    body: ownReview.body,
                    status: ownReview.status,
                  }
                : null
            }
            isSignedIn={Boolean(user)}
          />
        </section>

        {related.length > 0 && (
          <section className="mt-20 pt-12 border-t border-line">
            <SectionHeading eyebrow="شاید بپسندید" title="محصولات مرتبط" />
            <ProductGrid products={related} priorityCount={0} />
          </section>
        )}
      </div>
    </>
  )
}
