import 'server-only'

import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { type NavPlacement, navLinks, pages } from '@/db/schema'
import { CACHE_TAGS, cached } from '@/lib/cache'
import { SIZE_GUIDE_SLUG, type SizeGuide } from '@/lib/size-guide'

export const sizeGuide = cached(
  async (): Promise<SizeGuide | null> => {
    const [page] = await db
      .select({
        imagePath: pages.imagePath,
        title: pages.title,
        isPublished: pages.isPublished,
      })
      .from(pages)
      .where(eq(pages.slug, SIZE_GUIDE_SLUG))
      .limit(1)

    if (!page || !page.isPublished) return null

    return { imagePath: page.imagePath, title: page.title }
  },
  ['size-guide'],
  { revalidate: 3600, tags: [CACHE_TAGS.pages] },
)

export interface NavItem {
  label: string
  href: string
}

export const navLinksFor = cached(
  async (placement: NavPlacement): Promise<NavItem[]> => {
    const rows = await db
      .select({ label: navLinks.label, href: navLinks.href })
      .from(navLinks)
      .where(and(eq(navLinks.placement, placement), eq(navLinks.isVisible, true)))
      .orderBy(navLinks.sortOrder, navLinks.id)

    return rows
  },
  ['nav-links'],
  { revalidate: 3600, tags: [CACHE_TAGS.navigation] },
)
