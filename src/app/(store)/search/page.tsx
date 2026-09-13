import { SiteStyledText } from '@/components/site-content-provider'
import { ProductGrid } from '@/components/product-card'
import { EmptyState, Pagination } from '@/components/ui'
import { PAGE_SIZE, searchProducts } from '@/modules/catalog/queries'
import { searchParamsSchema } from '@/lib/validation'
import { toPersianDigits } from '@/lib/persian'
import { getSiteContent } from '@/lib/site-content'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const content = await getSiteContent()
  return {
  title: content.text('search.title'),
  robots: { index: false, follow: true },
  }
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
  const content = await getSiteContent()

  if (!term) {
    return (
      <div className="container-page py-16">
        <h1 className="text-3xl text-ink mb-8"><SiteStyledText contentKey="search.title">{content.text('search.title')}</SiteStyledText></h1>
        <EmptyState
          title={content.text('search.enterTitle')}
          description={content.text('search.enterDescription')}
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
        <p className="eyebrow mb-2"><SiteStyledText contentKey="search.results">{content.text('search.results')}</SiteStyledText></p>
        <h1 className="text-3xl md:text-4xl text-ink">«{term}»</h1>
        <p className="mt-3 text-sm text-ink-subtle nums">{toPersianDigits(total)} <SiteStyledText contentKey="search.foundSuffix">{content.text('search.foundSuffix')}</SiteStyledText></p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title={content.text('search.empty.title')}
          description={content.text('search.emptyDescription')}
          action={{ label: content.text('search.viewAll'), href: '/' }}
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
