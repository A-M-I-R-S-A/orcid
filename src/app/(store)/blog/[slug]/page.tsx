import { notFound, permanentRedirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { adminUsers, blogCategories, blogPosts } from '@/db/schema'
import { ResponsiveImage } from '@/components/media'
import { Breadcrumbs } from '@/components/ui'
import { findSlugRedirect } from '@/modules/catalog/queries'
import { getNamespace } from '@/lib/settings'
import { getSiteContent } from '@/lib/site-content'
import { articleSchema, breadcrumbSchema, buildMetadata, shouldIndex } from '@/lib/seo'
import { formatJalali } from '@/lib/jalali'
import { sanitizeHtml } from '@/lib/sanitize'
import { JsonLd } from '@/components/json-ld'

export const revalidate = 900

interface Props {
  params: Promise<{ slug: string }>
}

async function loadPost(rawSlug: string) {
  const slug = decodeURIComponent(rawSlug)

  const [post] = await db
    .select({
      post: blogPosts,
      categoryName: blogCategories.name,
      categorySlug: blogCategories.slug,
      authorName: adminUsers.fullName,
    })
    .from(blogPosts)
    .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
    .leftJoin(adminUsers, eq(blogPosts.authorAdminId, adminUsers.id))
    .where(eq(blogPosts.slug, slug))
    .limit(1)

  return { post, slug }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const { post } = await loadPost(slug)
  const content = await getSiteContent()

  if (!post) {
    return { title: content.text('meta.postNotFound'), robots: { index: false, follow: false } }
  }

  return buildMetadata({
    title: post.post.seoTitle || post.post.title,
    description: post.post.seoDescription || post.post.excerpt,
    path: `/blog/${encodeURIComponent(post.post.slug)}`,
    imagePath: post.post.coverImagePath,
    index: shouldIndex(post.post),
    type: 'article',
    publishedTime: post.post.publishedAt,
    modifiedTime: post.post.updatedAt,
  })
}

export default async function BlogPostPage({ params }: Props) {
  const { slug: rawSlug } = await params
  const { post, slug } = await loadPost(rawSlug)

  if (!post) {
    const redirectTo = await findSlugRedirect('blog_post', slug)
    if (redirectTo) permanentRedirect(`/blog/${encodeURIComponent(redirectTo)}`)
    notFound()
  }

  if (!post.post.isPublished) notFound()

  const [site, content] = await Promise.all([getNamespace('site'), getSiteContent()])

  const breadcrumbItems = [
    { name: content.text('common.home'), path: '/' },
    { name: content.text('blog.breadcrumb'), path: '/blog' },
    { name: post.post.title, path: `/blog/${encodeURIComponent(post.post.slug)}` },
  ]

  const schemas = [
    articleSchema({
      title: post.post.title,
      description: post.post.excerpt,
      slug: post.post.slug,
      imagePath: post.post.coverImagePath,
      publishedAt: post.post.publishedAt,
      updatedAt: post.post.updatedAt,
      authorName: post.authorName ?? undefined,
      siteName: site.siteName || 'ارکید',
    }),
    breadcrumbSchema(breadcrumbItems),
  ]

  return (
    <>
      <JsonLd data={schemas} />

      <div className="container-page py-6">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <article className="container-page pb-16">
        <header className="max-w-3xl mx-auto text-center mb-10">
          {post.categoryName && post.categorySlug && (
            <p className="eyebrow mb-4">{post.categoryName}</p>
          )}

          <h1 className="text-3xl md:text-5xl text-ink leading-[1.4]">{post.post.title}</h1>

          <div className="mt-6 flex items-center justify-center gap-4 text-sm text-ink-subtle">
            {post.post.publishedAt && (
              <time dateTime={post.post.publishedAt.toISOString()} className="nums">
                {formatJalali(post.post.publishedAt)}
              </time>
            )}
            {post.authorName && (
              <>
                <span aria-hidden="true">•</span>
                <span>{post.authorName}</span>
              </>
            )}
          </div>
        </header>

        {post.post.coverImagePath && (
          <div className="frame mx-auto mb-12 max-w-4xl">
            <ResponsiveImage
              path={post.post.coverImagePath}
              alt={post.post.coverImageAlt ?? post.post.title}
              width={1600}
              height={900}
              sizes="(min-width: 1024px) 900px, 100vw"
              priority
              className="w-full h-auto object-cover aspect-[16/9]"
            />
          </div>
        )}

        {post.post.body && (
          <div
            className="prose mx-auto text-ink-muted"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.post.body) }}
          />
        )}
      </article>
    </>
  )
}
