import 'server-only'

import { revalidateTag, unstable_cache } from 'next/cache'

/**
 * Data caching.
 *
 * ── Why not build-time prerendering ────────────────────────────────────────
 * The homepage, the blog index and the sitemap all read from the database. If
 * they were statically prerendered (`export const revalidate = N` on a route
 * with no dynamic segments), `next build` would have to reach MariaDB — and
 * the deployment plan builds OFF the host, where the production database is
 * bound to localhost and unreachable. Building against a staging database
 * instead would bake staging data into the shipped HTML, which is worse than
 * slow: it is wrong.
 *
 * So those routes render dynamically and cache their DATA here instead. The
 * expensive part (the queries) is still cached; only the React render repeats,
 * which is cheap. TTFB stays low, the build needs no database, and no stale
 * data is ever frozen into the artifact.
 *
 * Dynamic segments (/product/[slug], /category/[slug], /blog/[slug]) keep
 * ordinary ISR: without `generateStaticParams` Next renders them on demand and
 * caches the result, so they never touch the database at build either.
 */

export const CACHE_TAGS = {
  products: 'products',
  categories: 'categories',
  homepage: 'homepage',
  blog: 'blog',
  pages: 'pages',
  sitemap: 'sitemap',
} as const

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]

/**
 * Wraps a data function in the Next data cache.
 *
 * `keyParts` must capture every argument that changes the result — a cache key
 * that ignores an argument silently serves one caller another's data.
 */
export function cached<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  options: { revalidate: number; tags: CacheTag[] },
): (...args: Args) => Promise<Result> {
  return unstable_cache(fn, keyParts, {
    revalidate: options.revalidate,
    tags: options.tags,
  })
}

/**
 * Invalidates cached data after an administrative write.
 *
 * Called from admin actions alongside `revalidatePath`. The two are
 * complementary: revalidatePath drops rendered pages, this drops the data
 * behind them.
 */
export function invalidate(...tags: CacheTag[]): void {
  for (const tag of tags) revalidateTag(tag)
}
