import { describe, expect, it } from 'vitest'

import {
  absoluteUrl,
  breadcrumbSchema,
  facetsAreIndexable,
  jsonLd,
  productSchema,
  shouldIndex,
  siteUrl,
} from '@/lib/seo'

/**
 * SEO. §59 is the highest-priority requirement, and two of its rules are the
 * kind that break silently:
 *
 *   - AggregateRating must never appear without real approved reviews (§62).
 *   - Indexability must be decided in ONE place, so the sitemap and the page
 *     metadata cannot disagree (§68).
 */

describe('shouldIndex', () => {
  it('indexes a live product', () => {
    expect(shouldIndex({ isActive: true, isArchived: false })).toBe(true)
  })

  it('never indexes an archived product', () => {
    expect(shouldIndex({ isActive: true, isArchived: true })).toBe(false)
  })

  it('never indexes an inactive product', () => {
    expect(shouldIndex({ isActive: false, isArchived: false })).toBe(false)
  })

  it('never indexes a hidden category', () => {
    expect(shouldIndex({ isVisible: false })).toBe(false)
  })

  it('never indexes an unpublished post', () => {
    expect(shouldIndex({ isPublished: false })).toBe(false)
  })

  it('never indexes a future-dated post', () => {
    const tomorrow = new Date(Date.now() + 86_400_000)
    expect(shouldIndex({ isPublished: true, publishedAt: tomorrow })).toBe(false)
  })

  it('indexes a past-dated post', () => {
    const yesterday = new Date(Date.now() - 86_400_000)
    expect(shouldIndex({ isPublished: true, publishedAt: yesterday })).toBe(true)
  })
})

describe('facetsAreIndexable — §19/§70 thin-URL policy', () => {
  it('indexes the bare category', () => {
    expect(facetsAreIndexable({})).toBe(true)
  })

  it('indexes pagination — page 2 is not a facet', () => {
    expect(facetsAreIndexable({ page: '2' })).toBe(true)
  })

  it('indexes a single colour facet — people search for these', () => {
    expect(facetsAreIndexable({ color: 'مشکی' })).toBe(true)
  })

  it('indexes a single size facet', () => {
    expect(facetsAreIndexable({ size: '۷۵B' })).toBe(true)
  })

  it('refuses a facet combination — this is the combinatorial explosion', () => {
    expect(facetsAreIndexable({ color: 'مشکی', size: '۷۵B' })).toBe(false)
  })

  it('refuses sort orders — same content, different sequence', () => {
    expect(facetsAreIndexable({ sort: 'price_asc' })).toBe(false)
  })

  it('refuses price ranges — effectively unbounded', () => {
    expect(facetsAreIndexable({ minPrice: '100000' })).toBe(false)
  })

  it('ignores empty values rather than counting them as facets', () => {
    expect(facetsAreIndexable({ color: '', size: undefined })).toBe(true)
  })

  it('still indexes a single facet on page 2', () => {
    expect(facetsAreIndexable({ color: 'مشکی', page: '3' })).toBe(true)
  })
})

describe('productSchema — §62 never fabricate ratings', () => {
  const base = {
    name: 'سوتین بدون فنر',
    slug: 'سوتین-بدون-فنر',
    images: ['products/abc-1280.webp'],
    price: 285_000,
    inStock: true,
  }

  it('omits aggregateRating entirely when there are no reviews', () => {
    const schema = productSchema({ ...base, ratingCount: 0 })
    expect(schema).not.toHaveProperty('aggregateRating')
  })

  it('omits aggregateRating when the count is missing', () => {
    const schema = productSchema(base)
    expect(schema).not.toHaveProperty('aggregateRating')
  })

  it('includes aggregateRating only when real approved reviews back it', () => {
    const schema = productSchema({ ...base, ratingValue: 4.5, ratingCount: 12 })
    expect(schema.aggregateRating).toMatchObject({
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: 12,
    })
  })

  it('reports availability truthfully', () => {
    const inStock = productSchema({ ...base, inStock: true })
    const outOfStock = productSchema({ ...base, inStock: false })

    expect((inStock.offers as Record<string, string>).availability).toContain('InStock')
    expect((outOfStock.offers as Record<string, string>).availability).toContain('OutOfStock')
  })

  it('converts Toman to Rial for the IRR currency code', () => {
    // The stored unit is Toman; schema.org expects an ISO code, and IRR is
    // Rial. Quoting a Toman figure under IRR would be a factual error.
    const schema = productSchema({ ...base, price: 285_000 })
    const offer = schema.offers as Record<string, string>
    expect(offer.priceCurrency).toBe('IRR')
    expect(offer.price).toBe('2850000')
  })

  it('percent-encodes a Persian slug in the URL', () => {
    const schema = productSchema(base)
    expect(schema.url).toContain(encodeURIComponent('سوتین-بدون-فنر'))
  })
})

describe('breadcrumbSchema', () => {
  it('numbers positions from one', () => {
    const schema = breadcrumbSchema([
      { name: 'خانه', path: '/' },
      { name: 'سوتین', path: '/category/سوتین' },
    ])

    const items = schema.itemListElement as { position: number; name: string }[]
    expect(items[0]).toMatchObject({ position: 1, name: 'خانه' })
    expect(items[1]).toMatchObject({ position: 2, name: 'سوتین' })
  })

  it('uses absolute URLs — relative ones are invalid in BreadcrumbList', () => {
    const schema = breadcrumbSchema([{ name: 'خانه', path: '/' }])
    const items = schema.itemListElement as { item: string }[]
    expect(items[0]!.item).toMatch(/^https?:\/\//)
  })
})

describe('jsonLd serialisation', () => {
  it('escapes < so a product name cannot break out of the script tag', () => {
    // A product literally named "</script><script>alert(1)</script>" is the
    // attack; escaping the angle bracket is the defence.
    const output = jsonLd({ name: '</script><script>alert(1)</script>' })
    expect(output).not.toContain('</script>')
    expect(output).toContain('\\u003c')
  })

  it('round-trips as valid JSON', () => {
    const output = jsonLd({ '@type': 'Product', name: 'تست' })
    expect(() => JSON.parse(output.replace(/\\u003c/g, '<'))).not.toThrow()
  })
})

describe('URL helpers', () => {
  it('builds absolute URLs from APP_URL', () => {
    expect(absoluteUrl('/product/x')).toBe(`${siteUrl()}/product/x`)
  })

  it('adds a missing leading slash', () => {
    expect(absoluteUrl('product/x')).toBe(`${siteUrl()}/product/x`)
  })

  it('leaves an already-absolute URL alone', () => {
    expect(absoluteUrl('https://example.com/x')).toBe('https://example.com/x')
  })

  it('strips a trailing slash from the site URL so joins never double up', () => {
    expect(siteUrl().endsWith('/')).toBe(false)
  })
})
