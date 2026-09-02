import 'server-only'

import type { Metadata } from 'next'

import { getNamespace } from './settings'

/**
 * SEO. §59–§74.
 *
 * Two rules govern everything here:
 *
 *  1. Indexability is decided by ONE function (`shouldIndex`), which both the
 *     page metadata and the sitemap consult. If they each had their own logic
 *     they would eventually disagree, and a sitemap that lists noindex URLs is
 *     worse than no sitemap.
 *
 *  2. Structured data is emitted only when the page actually renders the thing
 *     it claims. §62 forbids fabricating ratings — so AggregateRating appears
 *     only when at least one approved review exists.
 */

export function siteUrl(): string {
  const raw = process.env.APP_URL ?? 'https://orchid-clothing.ir'
  return raw.replace(/\/+$/, '')
}

export function absoluteUrl(pathname: string): string {
  if (pathname.startsWith('http')) return pathname
  return siteUrl() + (pathname.startsWith('/') ? pathname : `/${pathname}`)
}

/* ── Facet indexation policy ────────────────────────────────────────────── */

/**
 * §19 / §70. A handful of filters can mint thousands of thin, near-duplicate
 * URLs. The policy: a SINGLE facet is indexable (people really do search for
 * "سوتین مشکی"); any combination, any sort, and any page-size change is not.
 *
 * Enforced in one place so no page can accidentally opt itself in.
 */
const INDEXABLE_FACETS = new Set(['color', 'size'])

export function facetsAreIndexable(searchParams: Record<string, string | string[] | undefined>): boolean {
  const active = Object.entries(searchParams).filter(([key, value]) => {
    if (value == null || value === '') return false
    // Pagination stays indexable; it is not a facet.
    if (key === 'page') return false
    return true
  })

  if (active.length === 0) return true
  if (active.length > 1) return false

  const [key] = active[0]!
  return INDEXABLE_FACETS.has(key)
}

export interface IndexabilityInput {
  isActive?: boolean
  isArchived?: boolean
  isPublished?: boolean
  isVisible?: boolean
  publishedAt?: Date | null
}

/** The single source of truth for "may a robot index this row". */
export function shouldIndex(entity: IndexabilityInput): boolean {
  if (entity.isArchived) return false
  if (entity.isActive === false) return false
  if (entity.isVisible === false) return false
  if (entity.isPublished === false) return false
  if (entity.publishedAt && entity.publishedAt.getTime() > Date.now()) return false
  return true
}

/* ── Metadata ───────────────────────────────────────────────────────────── */

export interface MetaInput {
  title: string
  description?: string | null
  path: string
  imagePath?: string | null
  index?: boolean
  type?: 'website' | 'article' | 'product'
  publishedTime?: Date | null
  modifiedTime?: Date | null
}

/**
 * Builds page metadata with a documented fallback chain:
 *   explicit SEO field → generated from content → site default.
 * No page ships an empty or duplicated title.
 */
export async function buildMetadata(input: MetaInput): Promise<Metadata> {
  const site = await getNamespace('site')
  const seo = await getNamespace('seo')

  const siteName = site.siteName || 'ارکید'
  const separator = seo.titleSeparator || ' | '

  const title = input.title.includes(siteName)
    ? input.title
    : `${input.title}${separator}${siteName}`

  const description =
    input.description?.trim() ||
    seo.defaultDescription ||
    'فروشگاه اینترنتی ارکید — لباس زیر زنانه با کیفیت'

  const canonical = absoluteUrl(input.path)
  const index = input.index !== false

  const ogImage = input.imagePath
    ? absoluteUrl(`/api/media/${input.imagePath}`)
    : absoluteUrl(seo.defaultOgImage || '/logo.png')

  return {
    /*
     * `absolute` bypasses the root layout's title template.
     *
     * Without it the site name is appended TWICE — once by the logic above,
     * which already checks whether the title contains it, and again by the
     * layout's `%s | ارکید` template. The homepage rendered as
     * "ارکید — فروشگاه لباس زیر زنانه | ارکید".
     *
     * This function owns the whole title, deliberately: it is the only place
     * that knows whether the page title already carries the brand, which is
     * what stops the homepage reading "ارکید | ارکید". Pages that do NOT go
     * through here keep the template and get the brand appended normally.
     */
    title: { absolute: title },
    description: description.slice(0, 320),
    alternates: { canonical },
    robots: index
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: true },
    openGraph: {
      type: input.type === 'article' ? 'article' : 'website',
      title,
      description,
      url: canonical,
      siteName,
      locale: 'fa_IR',
      images: [{ url: ogImage }],
      ...(input.publishedTime && { publishedTime: input.publishedTime.toISOString() }),
      ...(input.modifiedTime && { modifiedTime: input.modifiedTime.toISOString() }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

/* ── JSON-LD ────────────────────────────────────────────────────────────── */

type Json = Record<string, unknown>

export async function organizationSchema(): Promise<Json> {
  const site = await getNamespace('site')
  const contact = await getNamespace('contact')
  const social = await getNamespace('social')

  const sameAs = [social.instagram, social.telegram, social.whatsapp, social.twitter].filter(
    (v): v is string => Boolean(v),
  )

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.siteName || 'ارکید',
    url: siteUrl(),
    logo: absoluteUrl(site.logoPath ? `/api/media/${site.logoPath}` : '/logo.png'),
    ...(sameAs.length > 0 && { sameAs }),
    ...(contact.phone && {
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: contact.phone,
        contactType: 'customer service',
        areaServed: 'IR',
        availableLanguage: ['fa'],
      },
    }),
  }
}

export async function websiteSchema(): Promise<Json> {
  const site = await getNamespace('site')

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.siteName || 'ارکید',
    url: siteUrl(),
    inLanguage: 'fa-IR',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl()}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbSchema(items: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export interface ProductSchemaInput {
  name: string
  description?: string | null
  slug: string
  sku?: string | null
  images: string[]
  price: number
  inStock: boolean
  /** Only supply these when approved reviews actually exist. */
  ratingValue?: number
  ratingCount?: number
  brandName?: string
}

/**
 * Product + Offer. §63.
 *
 * `priceCurrency` is IRR because that is the ISO code Google expects; the
 * displayed unit is Toman. `price` is converted accordingly — quoting a Toman
 * figure under an IRR code would be a factual error in the markup.
 */
export function productSchema(input: ProductSchemaInput): Json {
  const schema: Json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    url: absoluteUrl(`/product/${encodeURIComponent(input.slug)}`),
    image: input.images.map((p) => absoluteUrl(`/api/media/${p}`)),
    ...(input.description && { description: input.description }),
    ...(input.sku && { sku: input.sku }),
    ...(input.brandName && { brand: { '@type': 'Brand', name: input.brandName } }),
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/product/${encodeURIComponent(input.slug)}`),
      priceCurrency: 'IRR',
      price: String(input.price * 10),
      availability: input.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }

  // §62: never fabricate ratings. Emitted only when real approved reviews back it.
  if (input.ratingCount && input.ratingCount > 0 && input.ratingValue) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.ratingValue.toFixed(1),
      reviewCount: input.ratingCount,
      bestRating: '5',
      worstRating: '1',
    }
  }

  return schema
}

export function articleSchema(input: {
  title: string
  description?: string | null
  slug: string
  imagePath?: string | null
  publishedAt?: Date | null
  updatedAt?: Date | null
  authorName?: string
  siteName: string
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    url: absoluteUrl(`/blog/${encodeURIComponent(input.slug)}`),
    mainEntityOfPage: absoluteUrl(`/blog/${encodeURIComponent(input.slug)}`),
    ...(input.description && { description: input.description }),
    ...(input.imagePath && { image: absoluteUrl(`/api/media/${input.imagePath}`) }),
    ...(input.publishedAt && { datePublished: input.publishedAt.toISOString() }),
    ...(input.updatedAt && { dateModified: input.updatedAt.toISOString() }),
    author: { '@type': input.authorName ? 'Person' : 'Organization', name: input.authorName ?? input.siteName },
    publisher: {
      '@type': 'Organization',
      name: input.siteName,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/logo.png') },
    },
    inLanguage: 'fa-IR',
  }
}

/**
 * Serialises JSON-LD for a <script> tag.
 * `<` is escaped so a product name containing "</script>" cannot break out of
 * the tag — a genuine XSS vector in hand-built structured data.
 */
export function jsonLd(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
