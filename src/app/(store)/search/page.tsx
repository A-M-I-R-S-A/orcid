import { ProductGrid } from '@/components/product-card'
import { EmptyState, Pagination } from '@/components/ui'
import { PAGE_SIZE, searchProducts } from '@/modules/catalog/queries'
import { searchParamsSchema } from '@/lib/validation'
import { toPersianDigits } from '@/lib/persian'

/**
 * Internal search results. §70.
 *
 * ALWAYS noindex, follow. Search result pages are the classic source of
 * infinite thin URLs — one per query anyone has ever typed — and indexing them
 * dilutes the category pages that should rank instead. `follow` is kept so
 * link equity still flows through to the products.
 *
 * Dynamic rather than cached: results depend entirely on the query.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'جستجو',
  robots: { index: false, follow: true },
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const parsed = searchParamsSchema.safeParse(query)
  const filters = parsed.success ? parsed.data : searchParamsSchema.parse({})
  const term = (filters.q ?? '').trim()

  if (!term) {
    return (
      <div className="container-page py-16">
        <h1 className="text-3xl text-ink mb-8">جستجو</h1>
        <EmptyState
          title="عبارتی برای جستجو وارد کنید"
          description="نام محصول، دسته‌بندی یا ویژگی مورد نظر خود را بنویسید."
        />
      </div>
    )
  }

  const { items, total, page, pageCount } = await searchProducts(term, {
    page: filters.page,
    sort: filters.sort,
    inStock: filters.inStock,
    limit: PAGE_SIZE,
  })

  return (
    <div className="container-page py-10 md:py-16">
      <header className="mb-10">
        <p className="eyebrow mb-2">نتایج جستجو</p>
        <h1 className="text-3xl md:text-4xl text-ink">«{term}»</h1>
        <p className="mt-3 text-sm text-ink-subtle nums">{toPersianDigits(total)} محصول یافت شد</p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="نتیجه‌ای یافت نشد"
          description="عبارت دیگری را امتحان کنید یا از دسته‌بندی‌ها استفاده کنید."
          action={{ label: 'مشاهده همه محصولات', href: '/' }}
        />
      ) : (
        <>
          <ProductGrid products={items} priorityCount={4} />
          <Pagination
            page={page}
            pageCount={pageCount}
            basePath="/search"
            searchParams={{ q: term }}
          />
        </>
      )}
    </div>
  )
}
