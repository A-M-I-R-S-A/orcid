import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'

import { ProductGallery, ProductPurchasePanel } from '@/components/product-detail'
import { sizeGuide } from '@/modules/content/queries'
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
import { JsonLd } from '@/components/json-ld'
import {
  breadcrumbSchema,
  buildMetadata,
  productSchema,
  shouldIndex,
} from '@/lib/seo'

export const revalidate = 600

interface Props {
  params: Promise<{ slug: string }>
}

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
    index: shouldIndex(product),
    type: 'product',
  })
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const { product } = await resolve(slug)

  if (!product) notFound()

  if (product.isArchived || !product.isActive) notFound()

  const [trail, related, reviews, user, guide] = await Promise.all([
    product.primaryCategoryId ? categoryTrail(product.primaryCategoryId) : Promise.resolve([]),
    relatedProducts(product.id, product.primaryCategoryId, 4),
    reviewService.listForProduct(product.id),
    getCurrentUser(),
    sizeGuide(),
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
      ratingValue,
      ratingCount: product.ratingCount,
    }),
    breadcrumbSchema(breadcrumbItems),
  ]

  return (
    <>
      <JsonLd data={schemas} />

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
              <ProductPurchasePanel product={product} sizeGuide={guide} />
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
            <SectionHeading title="محصولات مرتبط" />
            <ProductGrid products={related} priorityCount={0} />
          </section>
        )}
      </div>
    </>
  )
}
