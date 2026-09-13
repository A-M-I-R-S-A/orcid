import { asc } from 'drizzle-orm'

import { db } from '@/db'
import { pageSections, pages } from '@/db/schema'
import { PageHeader } from '@/components/admin/ui'
import { PageManager } from '@/components/admin/page-manager'
import { requirePermission } from '@/modules/admin/auth'
import type { PageSectionRecord } from '@/lib/page-sections'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'صفحات' }

export default async function AdminPagesPage() {
  await requirePermission('content.pages')

  const [rows, sections] = await Promise.all([
    db.select().from(pages).orderBy(asc(pages.sortOrder), asc(pages.title)),
    db.select().from(pageSections).orderBy(asc(pageSections.pageId), asc(pageSections.sortOrder)),
  ])

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
          sections: sections.filter((section) => section.pageId === page.id) as PageSectionRecord[],
        }))}
      />
    </>
  )
}
