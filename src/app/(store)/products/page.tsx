import { ProductGrid } from '@/components/product-card'
import { Breadcrumbs, EmptyState, Pagination } from '@/components/ui'
import { FilterBar } from '@/components/filters'
import { PAGE_SIZE, categoryFacets, listProducts } from '@/modules/catalog/queries'
import { searchParamsSchema } from '@/lib/validation'
import { breadcrumbSchema, buildMetadata, facetsAreIndexable } from '@/lib/seo'
import { toPersianDigits } from '@/lib/persian'
import { JsonLd } from '@/components/json-ld'

export const revalidate = 600

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ searchParams }: Props) {
  const query = await searchParams
  const page = Number(query.page ?? 1)

  return buildMetadata({
    title: page > 1 ? `همه محصولات — صفحه ${toPersianDigits(page)}` : 'همه محصولات',
    description:
      'همه محصولات ارکید در یک صفحه؛ سوتین، شورت، ست و لباس خواب با امکان فیلتر بر اساس رنگ، سایز و موجودی.',
    path: page > 1 ? `/products?page=${page}` : '/products',
    index: facetsAreIndexable(query),
  })
}

export default async function AllProductsPage({ searchParams }: Props) {
  const query = await searchParams

  const parsed = searchParamsSchema.safeParse(query)
  const filters = parsed.success ? parsed.data : searchParamsSchema.parse({})

  const [{ items, total, page, pageCount }, facets] = await Promise.all([
    listProducts({
      page: filters.page,
      sort: filters.sort,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      color: filters.color,
      size: filters.size,
      inStock: filters.inStock,
      limit: PAGE_SIZE,
    }),
    categoryFacets(),
  ])

  const breadcrumbItems = [
    { name: 'خانه', path: '/' },
    { name: 'همه محصولات', path: '/products' },
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
            <p className="eyebrow mb-3">مجموعه کامل</p>
            <h1 className="section-title">همه محصولات</h1>
            <p className="mt-4 max-w-2xl leading-relaxed text-ink-muted">
              همه چیزهایی که در ارکید موجود است، بدون دسته‌بندی. با رنگ، سایز و موجودی فیلتر کنید.
            </p>
          </div>
          <p className="nums shrink-0 text-sm text-ink-subtle">{toPersianDigits(total)} محصول</p>
        </header>

        <FilterBar basePath="/products" facets={facets} active={filters} />

        <div className="mt-10 pb-4">
          {items.length === 0 ? (
            <EmptyState
              title="محصولی یافت نشد"
              description="با فیلترهای انتخاب‌شده محصولی موجود نیست. فیلترها را تغییر دهید."
              action={{ label: 'حذف فیلترها', href: '/products' }}
            />
          ) : (
            <>
              <ProductGrid products={items} priorityCount={4} />
              <Pagination
                page={page}
                pageCount={pageCount}
                basePath="/products"
                searchParams={activeParams}
              />
            </>
          )}
        </div>
      </div>
    </>
  )
}
