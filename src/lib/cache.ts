import 'server-only'

import { revalidateTag, unstable_cache } from 'next/cache'

export const CACHE_TAGS = {
  products: 'products',
  categories: 'categories',
  homepage: 'homepage',
  blog: 'blog',
  pages: 'pages',
  navigation: 'navigation',
  sitemap: 'sitemap',
} as const

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]

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

export function invalidate(...tags: CacheTag[]): void {
  for (const tag of tags) revalidateTag(tag)
}
