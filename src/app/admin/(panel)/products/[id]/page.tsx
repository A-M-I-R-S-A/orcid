import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/admin/ui'
import { ProductEditor } from '@/components/admin/product-editor'
import { getProductBySlug, listCategories } from '@/modules/catalog/queries'
import { requirePermission } from '@/modules/admin/auth'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ویرایش محصول' }

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const isNew = id === 'new'

  await requirePermission(isNew ? 'products.create' : 'products.update')

  const categories = await listCategories(false)

  if (isNew) {
    return (
      <>
        <div className="mb-2">
          <Link href="/admin/products" className="text-sm text-accent-2 hover:underline">
            ← محصولات
          </Link>
        </div>
        <PageHeader
          title="محصول جدید"
          description="ابتدا اطلاعات پایه را ذخیره کنید، سپس ویژگی‌ها، تنوع‌ها و تصاویر را اضافه کنید."
        />
        <ProductEditor
          product={null}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </>
    )
  }

  const productId = Number(id)
  if (!Number.isInteger(productId) || productId <= 0) notFound()

  const [row] = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  if (!row) notFound()

  const product = await getProductBySlug(row.slug)
  if (!product) notFound()

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-4">
        <Link href="/admin/products" className="text-sm text-accent-2 hover:underline">
          ← محصولات
        </Link>
        <Link
          href={`/product/${encodeURIComponent(product.slug)}`}
          target="_blank"
          rel="noopener"
          className="text-sm text-accent-2 hover:underline"
        >
          مشاهده در فروشگاه ↗
        </Link>
      </div>

      <PageHeader title={product.name} description={`/product/${product.slug}`} />

      <ProductEditor
        product={product}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </>
  )
}
