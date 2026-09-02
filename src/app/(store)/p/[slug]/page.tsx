import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { pages } from '@/db/schema'
import { Breadcrumbs } from '@/components/ui'
import { breadcrumbSchema, buildMetadata, jsonLd, shouldIndex } from '@/lib/seo'
import { sanitizeHtml } from '@/lib/sanitize'

/** CMS pages — about, contact, FAQ, terms, privacy, shipping, returns. §53. */
export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

async function loadPage(rawSlug: string) {
  const slug = decodeURIComponent(rawSlug)
  const [page] = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1)
  return page ?? null
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const page = await loadPage(slug)

  if (!page) {
    return { title: 'صفحه یافت نشد', robots: { index: false, follow: false } }
  }

  return buildMetadata({
    title: page.seoTitle || page.title,
    description: page.seoDescription,
    path: `/p/${encodeURIComponent(page.slug)}`,
    index: shouldIndex(page),
  })
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params
  const page = await loadPage(slug)

  if (!page || !page.isPublished) notFound()

  const breadcrumbItems = [
    { name: 'خانه', path: '/' },
    { name: page.title, path: `/p/${encodeURIComponent(page.slug)}` },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema(breadcrumbItems)) }}
      />

      <div className="container-page py-6">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <article className="container-page pb-20">
        <header className="max-w-3xl mb-10">
          <h1 className="text-3xl md:text-5xl text-ink leading-[1.4]">{page.title}</h1>
        </header>

        {page.body && (
          <div
            className="prose text-ink-muted"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }}
          />
        )}
      </article>
    </>
  )
}
