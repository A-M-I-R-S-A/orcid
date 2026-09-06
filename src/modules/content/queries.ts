import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { pages } from '@/db/schema'
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
