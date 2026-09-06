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
  return buildMetadata({
    title: 'مجله ارکید',
    description: 'راهنمای انتخاب سایز، نگهداری لباس زیر و مطالب خواندنی درباره پوشاک زنانه.',
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

  const { posts, total } = await loadPosts(page)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const breadcrumbItems = [
    { name: 'خانه', path: '/' },
    { name: 'مجله', path: '/blog' },
  ]

  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbItems)} />

      <div className="container-page py-6">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <div className="container-page pb-16">
        <header className="max-w-2xl mb-12">
          <p className="eyebrow mb-3">مجله ارکید</p>
          <h1 className="text-3xl md:text-5xl text-ink leading-[1.4]">خواندنی‌ها</h1>
          <p className="mt-5 text-ink-muted leading-relaxed">
            راهنمای انتخاب سایز، نکات نگهداری و آنچه پیش از خرید خوب است بدانید.
          </p>
        </header>

        {posts.length === 0 ? (
          <EmptyState title="هنوز نوشته‌ای منتشر نشده است" />
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
