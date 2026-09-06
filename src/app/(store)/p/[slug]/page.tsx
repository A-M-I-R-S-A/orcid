import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { pages } from '@/db/schema'
import { ResponsiveImage } from '@/components/media'
import { Breadcrumbs } from '@/components/ui'
import { breadcrumbSchema, buildMetadata, shouldIndex } from '@/lib/seo'
import { sanitizeHtml } from '@/lib/sanitize'
import { JsonLd } from '@/components/json-ld'

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
      <JsonLd data={breadcrumbSchema(breadcrumbItems)} />

      <div className="container-page py-6">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <article className="container-page pb-20">
        <header className="max-w-3xl mb-10">
          <h1 className="text-3xl md:text-5xl text-ink leading-[1.4]">{page.title}</h1>
        </header>

        {page.imagePath && (
          <figure className="mb-10 max-w-3xl">
            <div className="frame bg-surface-sunken p-3 sm:p-5">
              <ResponsiveImage
                path={page.imagePath}
                alt={page.title}
                width={1200}
                height={900}
                sizes="(min-width: 768px) 48rem, 100vw"
                className="mx-auto h-auto w-full object-contain"
              />
            </div>
          </figure>
        )}

        {page.body && (
          <div
            className="prose max-w-3xl text-ink-muted"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }}
          />
        )}
      </article>
    </>
  )
}
