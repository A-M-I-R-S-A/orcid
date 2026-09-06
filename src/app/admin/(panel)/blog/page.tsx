import { desc } from 'drizzle-orm'

import { db } from '@/db'
import { blogCategories, blogPosts } from '@/db/schema'
import { PageHeader } from '@/components/admin/ui'
import { BlogManager } from '@/components/admin/blog-manager'
import { requirePermission } from '@/modules/admin/auth'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'وبلاگ' }

export default async function AdminBlogPage() {
  await requirePermission('blog.view')

  const [posts, categories] = await Promise.all([
    db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt)),
    db.select().from(blogCategories).orderBy(blogCategories.name),
  ])

  return (
    <>
      <PageHeader title="وبلاگ" description="نوشته‌های مجله ارکید" />

      <BlogManager
        posts={posts.map((post) => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          body: post.body ?? '',
          categoryId: post.categoryId,
          isPublished: post.isPublished,
          publishedAt: post.publishedAt,
          coverImagePath: post.coverImagePath,
          coverImageAlt: post.coverImageAlt,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </>
  )
}
