import { notFound, permanentRedirect } from 'next/navigation'

import { ProductGrid } from '@/components/product-card'
import { Breadcrumbs, EmptyState, Pagination } from '@/components/ui'
import { FilterBar } from '@/components/filters'
import {
  PAGE_SIZE,
  categoryFacets,
  categoryTrail,
  findSlugRedirect,
  getCategoryBySlug,
  listProducts,
} from '@/modules/catalog/queries'
import { searchParamsSchema } from '@/lib/validation'
import {
  breadcrumbSchema,
  buildMetadata,
  facetsAreIndexable,
  shouldIndex,
} from '@/lib/seo'
import { toPersianDigits } from '@/lib/persian'
import { JsonLd } from '@/components/json-ld'

export const revalidate = 600

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params
  const query = await searchParams
  const category = await getCategoryBySlug(decodeURIComponent(slug))

  if (!category) {
    return { title: 'دسته‌بندی یافت نشد', robots: { index: false, follow: false } }
  }

  const page = Number(query.page ?? 1)

  return buildMetadata({
    title:
      category.seoTitle ||
      (page > 1 ? `${category.name} — صفحه ${toPersianDigits(page)}` : category.name),
    description: category.seoDescription || category.description,
    path:
      page > 1
        ? `/category/${encodeURIComponent(category.slug)}?page=${page}`
        : `/category/${encodeURIComponent(category.slug)}`,
    imagePath: category.imagePath,
    index: shouldIndex(category) && facetsAreIndexable(query),
  })
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug: rawSlug } = await params
  const slug = decodeURIComponent(rawSlug)
  const query = await searchParams

  const category = await getCategoryBySlug(slug)

  if (!category) {
    const redirectTo = await findSlugRedirect('category', slug)
    if (redirectTo) permanentRedirect(`/category/${encodeURIComponent(redirectTo)}`)
    notFound()
  }

  if (!category.isVisible) notFound()

  const parsed = searchParamsSchema.safeParse(query)
  const filters = parsed.success ? parsed.data : searchParamsSchema.parse({})

  const [{ items, total, page, pageCount }, facets, trail] = await Promise.all([
    listProducts({
      categoryId: category.id,
      page: filters.page,
      sort: filters.sort,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      color: filters.color,
      size: filters.size,
      inStock: filters.inStock,
      limit: PAGE_SIZE,
    }),
    categoryFacets(category.id),
    categoryTrail(category.id),
  ])

  const breadcrumbItems = [
    { name: 'خانه', path: '/' },
    ...trail.map((c) => ({ name: c.name, path: `/category/${encodeURIComponent(c.slug)}` })),
  ]

  const activeParams: Record<string, string | undefined> = {
    sort: filters.sort !== 'newest' ? filters.sort : undefined,
    color: filters.color,
    size: filters.size,
    minPrice: filters.minPrice ? String(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice ? String(filters.maxPrice) : undefined,
    inStock: filters.inStock ? '1' : undefined,
  }

  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbItems)} />

      <div className="container-page py-5">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <div className="container-page">
        <header className="mb-9 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="max-w-3xl">
            <h1 className="section-title">{category.name}</h1>
            {category.description && (
              <p className="mt-4 max-w-2xl leading-relaxed text-ink-muted">
                {category.description}
              </p>
            )}
          </div>
          <p className="nums shrink-0 text-sm text-ink-subtle">
            {toPersianDigits(total)} محصول
          </p>
        </header>

        <FilterBar
          basePath={`/category/${encodeURIComponent(category.slug)}`}
          facets={facets}
          active={filters}
        />

        <div className="mt-10 pb-4">
          {items.length === 0 ? (
            <EmptyState
              title="محصولی یافت نشد"
              description="با فیلترهای انتخاب‌شده محصولی موجود نیست. فیلترها را تغییر دهید."
              action={{ label: 'حذف فیلترها', href: `/category/${encodeURIComponent(category.slug)}` }}
            />
          ) : (
            <>
              <ProductGrid products={items} priorityCount={4} />
              <Pagination
                page={page}
                pageCount={pageCount}
                basePath={`/category/${encodeURIComponent(category.slug)}`}
                searchParams={activeParams}
              />
            </>
          )}
        </div>
      </div>
    </>
  )
}
