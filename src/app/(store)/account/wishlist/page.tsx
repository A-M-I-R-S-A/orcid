import { ProductGrid } from '@/components/product-card'
import { EmptyState } from '@/components/ui'
import { listWishlist } from '@/modules/account/service'
import { requireUser } from '@/lib/session'
import { toPersianDigits } from '@/lib/persian'

export const metadata = { title: 'علاقه‌مندی‌ها' }

export default async function WishlistPage() {
  const user = await requireUser()
  const products = await listWishlist(user.id)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow mb-3">حساب کاربری</p>
          <h1 className="section-title">علاقه‌مندی‌ها</h1>
        </div>
        {products.length > 0 && (
          <p className="nums text-sm text-ink-subtle">
            {toPersianDigits(products.length)} محصول
          </p>
        )}
      </header>

      {products.length === 0 ? (
        <EmptyState
          title="فهرست علاقه‌مندی‌ها خالی است"
          description="محصولی که می‌پسندید را با زدن نشان قلب ذخیره کنید تا بعداً راحت پیدایش کنید."
          action={{ label: 'مشاهده محصولات', href: '/' }}
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
