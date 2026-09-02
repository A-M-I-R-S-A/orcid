import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/seo'

/**
 * robots.txt. §69.
 *
 * What is disallowed: private areas and low-value URL spaces.
 * What is deliberately NOT disallowed: /_next/static, /api/media, and every
 * product, category and blog path. Blocking CSS, JS or images stops Google
 * rendering the page and is one of the most common self-inflicted SEO wounds —
 * §69 calls it out explicitly, so the allowances below are stated rather than
 * merely implied by omission.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          // Stated explicitly so a future edit cannot accidentally block them.
          '/_next/static/',
          '/_next/image',
          '/api/media/',
        ],
        disallow: [
          '/admin',
          '/admin/',
          '/account',
          '/account/',
          '/cart',
          '/checkout',
          '/login',
          '/order/',
          // Internal search results — infinite thin URLs, noindexed at the
          // page level too, but keeping crawlers out saves the budget.
          '/search',
          '/api/',
          // Filter and sort combinations. The single-facet URLs we DO want
          // indexed are linked from the category page and reachable; this only
          // stops crawlers wandering the full combinatorial space.
          '/*?*sort=',
          '/*?*minPrice=',
          '/*?*maxPrice=',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/').replace(/\/$/, ''),
  }
}
