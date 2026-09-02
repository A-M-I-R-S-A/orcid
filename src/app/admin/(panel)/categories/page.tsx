import { PageHeader } from '@/components/admin/ui'
import { CategoryManager } from '@/components/admin/category-manager'
import { listCategories } from '@/modules/catalog/queries'
import { requirePermission } from '@/modules/admin/auth'
import { getCurrentAdmin } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { db } from '@/db'
import { products } from '@/db/schema'
import { sql } from 'drizzle-orm'

/** Category management. §42. */
export const dynamic = 'force-dynamic'
export const metadata = { title: 'دسته‌بندی‌ها' }

export default async function AdminCategoriesPage() {
  await requirePermission('categories.view')
  const admin = await getCurrentAdmin()

  const [categories, counts] = await Promise.all([
    listCategories(false),
    db
      .select({
        categoryId: products.primaryCategoryId,
        count: sql<number>`COUNT(*)`,
      })
      .from(products)
      .where(sql`${products.isArchived} = 0`)
      .groupBy(products.primaryCategoryId),
  ])

  const countBy = new Map(counts.map((c) => [c.categoryId, Number(c.count)]))

  return (
    <>
      <PageHeader
        title="دسته‌بندی‌ها"
        description="ساختار، ترتیب نمایش و سئوی دسته‌بندی‌های فروشگاه"
      />

      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          parentId: c.parentId,
          sortOrder: c.sortOrder,
          isVisible: c.isVisible,
          imagePath: c.imagePath,
          seoTitle: c.seoTitle,
          seoDescription: c.seoDescription,
          productCount: countBy.get(c.id) ?? 0,
        }))}
        canEdit={admin ? hasPermission(admin, 'categories.manage') : false}
      />
    </>
  )
}
