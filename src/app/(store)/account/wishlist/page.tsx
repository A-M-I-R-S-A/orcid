import { SiteStyledText } from '@/components/site-content-provider'
import { ProductGrid } from '@/components/product-card'
import { EmptyState } from '@/components/ui'
import { listWishlist } from '@/modules/account/service'
import { requireUser } from '@/lib/session'
import { toPersianDigits } from '@/lib/persian'
import { getSiteContent } from '@/lib/site-content'

export async function generateMetadata() { const content = await getSiteContent(); return { title: content.text('account.wishlist.title') } }

export default async function WishlistPage() {
  const user = await requireUser()
  const products = await listWishlist(user.id)
  const content = await getSiteContent()

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow mb-3"><SiteStyledText contentKey="account.eyebrow">{content.text('account.eyebrow')}</SiteStyledText></p>
          <h1 className="section-title"><SiteStyledText contentKey="account.wishlist.title">{content.text('account.wishlist.title')}</SiteStyledText></h1>
        </div>
        {products.length > 0 && (
          <p className="nums text-sm text-ink-subtle">
            {toPersianDigits(products.length)} <SiteStyledText contentKey="catalog.productSuffix">{content.text('catalog.productSuffix')}</SiteStyledText>
          </p>
        )}
      </header>

      {products.length === 0 ? (
        <EmptyState
          title={content.text('account.wishlist.empty')}
          description={content.text('account.wishlist.description')}
          action={{ label: content.text('common.viewProducts'), href: '/' }}
        />
      ) : (
        <ProductGrid
          products={products}
          priorityCount={4}
          savedIds={new Set(products.map((p) => p.id))}
          sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 45vw"
        />
      )}
    </div>
  )
}
