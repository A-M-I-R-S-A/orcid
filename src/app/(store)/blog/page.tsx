import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { blogPosts } from '@/db/schema'
import { ResponsiveImage } from '@/components/media'
import { Breadcrumbs, EmptyState, Pagination } from '@/components/ui'
import { CACHE_TAGS, cached } from '@/lib/cache'
import { breadcrumbSchema, buildMetadata } from '@/lib/seo'
import { formatJalali } from '@/lib/jalali'
import { JsonLd } from '@/components/json-ld'
import { getSiteContent } from '@/lib/site-content'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

const loadPosts = cached(
  async (page: number) => {
    const [posts, [countRow]] = await Promise.all([
      db
        .select({
          id: blogPosts.id,
          title: blogPosts.title,
          slug: blogPosts.slug,
          excerpt: blogPosts.excerpt,
          coverImagePath: blogPosts.coverImagePath,
          coverImageAlt: blogPosts.coverImageAlt,
          publishedAt: blogPosts.publishedAt,
        })
        .from(blogPosts)
        .where(eq(blogPosts.isPublished, true))
        .orderBy(desc(blogPosts.publishedAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(blogPosts)
        .where(eq(blogPosts.isPublished, true)),
    ])

    return { posts, total: Number(countRow?.count ?? 0) }
  },
  ['blog-index'],
  { revalidate: 900, tags: [CACHE_TAGS.blog] },
)

export async function generateMetadata() {
  const content = await getSiteContent()
  return buildMetadata({
    title: content.text('blog.title'),
    description: content.text('blog.metaDescription'),
    path: '/blog',
  })
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: rawPage } = await searchParams
  const page = Math.max(1, Number(rawPage ?? 1) || 1)
  const content = await getSiteContent()

  const { posts, total } = await loadPosts(page)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const breadcrumbItems = [
    { name: content.text('common.home'), path: '/' },
    { name: content.text('blog.breadcrumb'), path: '/blog' },
  ]

  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbItems)} />

      <div className="container-page py-6">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <div className="container-page pb-16">
        <header className="max-w-2xl mb-12">
          <p className="eyebrow mb-3"><SiteStyledText contentKey="blog.title">{content.text('blog.title')}</SiteStyledText></p>
          <h1 className="text-3xl md:text-5xl text-ink leading-[1.4]"><SiteStyledText contentKey="blog.heading">{content.text('blog.heading')}</SiteStyledText></h1>
          <p className="mt-5 text-ink-muted leading-relaxed">
            <SiteStyledText contentKey="blog.description">{content.text('blog.description')}</SiteStyledText>
          </p>
        </header>

        {posts.length === 0 ? (
          <EmptyState title={content.text('blog.empty')} />
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
              {posts.map((post, i) => (
                <article key={post.id}>
                  <Link href={`/blog/${encodeURIComponent(post.slug)}`} className="group block">
                    <div className="frame aspect-[3/2]">
                      <ResponsiveImage
                        path={post.coverImagePath}
                        alt={post.coverImageAlt ?? post.title}
                        width={800}
                        height={534}
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        priority={i < 3}
                        className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                      />
                    </div>

                    <h2 className="mt-5 text-xl text-ink leading-snug group-hover:text-accent-2 transition-colors">
                      {post.title}
                    </h2>

                    {post.excerpt && (
                      <p className="mt-2.5 text-sm text-ink-muted leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}

                    {post.publishedAt && (
                      <time
                        dateTime={post.publishedAt.toISOString()}
                        className="mt-4 block text-xs text-ink-subtle nums"
                      >
                        {formatJalali(post.publishedAt)}
                      </time>
                    )}
                  </Link>
                </article>
              ))}
            </div>

            <Pagination page={page} pageCount={pageCount} basePath="/blog" />
          </>
        )}
      </div>
    </>
  )
}
