import { asc } from 'drizzle-orm'

import { db } from '@/db'
import { pages } from '@/db/schema'
import { PageHeader } from '@/components/admin/ui'
import { PageManager } from '@/components/admin/page-manager'
import { requirePermission } from '@/modules/admin/auth'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'صفحات' }

export default async function AdminPagesPage() {
  await requirePermission('content.pages')

  const rows = await db.select().from(pages).orderBy(asc(pages.sortOrder), asc(pages.title))

  return (
    <>
      <PageHeader
        title="صفحات"
        description="درباره ما، تماس، سوالات متداول، قوانین، حریم خصوصی و سایر صفحات ثابت"
      />

      <PageManager
        pages={rows.map((page) => ({
          id: page.id,
          slug: page.slug,
          title: page.title,
          body: page.body ?? '',
          isPublished: page.isPublished,
          showInFooter: page.showInFooter,
          sortOrder: page.sortOrder,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          imagePath: page.imagePath,
        }))}
      />
    </>
  )
}
