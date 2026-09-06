import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
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
          '/search',
          '/api/',
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
