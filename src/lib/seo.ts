import 'server-only'

import type { Metadata } from 'next'

import { getNamespace } from './settings'

export function siteUrl(): string {
  const raw = process.env.APP_URL ?? 'https://orchidbra.ir'
  return raw.replace(/\/+$/, '')
}

export function absoluteUrl(pathname: string): string {
  if (pathname.startsWith('http')) return pathname
  return siteUrl() + (pathname.startsWith('/') ? pathname : `/${pathname}`)
}

const INDEXABLE_FACETS = new Set(['color', 'size'])

export function facetsAreIndexable(searchParams: Record<string, string | string[] | undefined>): boolean {
  const active = Object.entries(searchParams).filter(([key, value]) => {
    if (value == null || value === '') return false
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

export function shouldIndex(entity: IndexabilityInput): boolean {
  if (entity.isArchived) return false
  if (entity.isActive === false) return false
  if (entity.isVisible === false) return false
  if (entity.isPublished === false) return false
  if (entity.publishedAt && entity.publishedAt.getTime() > Date.now()) return false
  return true
}

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

export type Json = Record<string, unknown>

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
  ratingValue?: number
  ratingCount?: number
  brandName?: string
}

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

export function jsonLd(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
