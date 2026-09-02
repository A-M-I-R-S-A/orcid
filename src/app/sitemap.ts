import type { MetadataRoute } from 'next'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { blogPosts, categories, pages, products } from '@/db/schema'
import { CACHE_TAGS, cached } from '@/lib/cache'
import { absoluteUrl } from '@/lib/seo'

/**
 * XML sitemap. §68.
 *
 * The predicates here are the SAME conditions `shouldIndex` applies on the
 * page — active, not archived, published. That matters more than it looks: if
 * the sitemap had its own notion of "indexable" the two would eventually
 * disagree, and a sitemap advertising noindex URLs is worse than none at all.
 *
 * Excluded by construction, because they are never queried: admin, cart,
 * checkout, login, account, order payment, internal search, and the API.
 *
 * Rendered dynamically with its data cached for an hour rather than
 * prerendered — see lib/cache.ts for why the build must not need a database.
 */
export const dynamic = 'force-dynamic'

const loadEntries = cached(
  async () => {
    const [productRows, categoryRows, postRows, pageRows] = await Promise.all([
    db
      .select({ slug: products.slug, updatedAt: products.updatedAt })
      .from(products)
      .where(and(eq(products.isActive, true), eq(products.isArchived, false))),

    db
      .select({ slug: categories.slug, updatedAt: categories.updatedAt })
      .from(categories)
      .where(eq(categories.isVisible, true)),

    db
      .select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt })
      .from(blogPosts)
      .where(eq(blogPosts.isPublished, true)),

    db
      .select({ slug: pages.slug, updatedAt: pages.updatedAt })
      .from(pages)
      .where(eq(pages.isPublished, true)),
    ])

    return { productRows, categoryRows, postRows, pageRows }
  },
  ['sitemap-entries'],
  { revalidate: 3600, tags: [CACHE_TAGS.sitemap, CACHE_TAGS.products, CACHE_TAGS.categories, CACHE_TAGS.blog, CACHE_TAGS.pages] },
)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { productRows, categoryRows, postRows, pageRows } = await loadEntries()

  return [
    {
      url: absoluteUrl('/'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: absoluteUrl('/blog'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },

    ...categoryRows.map((row) => ({
      url: absoluteUrl(`/category/${encodeURIComponent(row.slug)}`),
      lastModified: row.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),

    ...productRows.map((row) => ({
      url: absoluteUrl(`/product/${encodeURIComponent(row.slug)}`),
      lastModified: row.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),

    ...postRows.map((row) => ({
      url: absoluteUrl(`/blog/${encodeURIComponent(row.slug)}`),
      lastModified: row.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),

    ...pageRows.map((row) => ({
      url: absoluteUrl(`/p/${encodeURIComponent(row.slug)}`),
      lastModified: row.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
  ]
}
