import { describe, expect, it } from 'vitest'

import { encodeSlug, slugify, uniqueSlug } from '@/lib/slug'
import { buildSrcSet, contentTypeFor, jpegFallbackUrl, mediaUrl, renditionPaths } from '@/lib/media-url'
import {
  DEFAULT_THEME,
  contrastGrade,
  contrastRatio,
  isValidHex,
  mix,
  readableOn,
  themeToCss,
} from '@/lib/color'

describe('slugify', () => {
  it('keeps Persian characters — §H, slugs are Persian', () => {
    expect(slugify('سوتین بدون فنر')).toBe('سوتین-بدون-فنر')
  })

  it('turns ZWNJ into a hyphen so compounds stay readable', () => {
    expect(slugify('بدون‌فنر')).toBe('بدون-فنر')
  })

  it('collapses repeated separators', () => {
    expect(slugify('a   b')).toBe('a-b')
    expect(slugify('a---b')).toBe('a-b')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -test-  ')).toBe('test')
  })

  it('strips punctuation that would need escaping in a URL', () => {
    expect(slugify('سوتین (مدل جدید)!')).toBe('سوتین-مدل-جدید')
  })

  it('lowercases Latin text', () => {
    expect(slugify('Silk Bra')).toBe('silk-bra')
  })

  it('caps length so a long name cannot overflow the column', () => {
    expect(slugify('a'.repeat(500)).length).toBeLessThanOrEqual(180)
  })

  it('returns empty for empty input', () => {
    expect(slugify('')).toBe('')
  })
})

describe('uniqueSlug', () => {
  it('returns the base when it is free', async () => {
    expect(await uniqueSlug('سوتین', async () => false)).toBe('سوتین')
  })

  it('appends a suffix when taken', async () => {
    const taken = new Set(['سوتین'])
    expect(await uniqueSlug('سوتین', async (s) => taken.has(s))).toBe('سوتین-2')
  })

  it('keeps counting past several collisions', async () => {
    const taken = new Set(['x', 'x-2', 'x-3'])
    expect(await uniqueSlug('x', async (s) => taken.has(s))).toBe('x-4')
  })

  it('falls back to something free rather than looping forever', async () => {
    const result = await uniqueSlug('x', async () => true)
    expect(result.startsWith('x-')).toBe(true)
  })

  it('substitutes a placeholder for an unusable name', async () => {
    expect(await uniqueSlug('!!!', async () => false)).toBe('item')
  })
})

describe('encodeSlug', () => {
  it('percent-encodes Persian for use in a path', () => {
    expect(encodeSlug('سوتین')).toBe(encodeURIComponent('سوتین'))
  })
})

describe('media URLs', () => {
  const primary = 'products/a1b2c3-1280.webp'

  it('builds a media route URL', () => {
    expect(mediaUrl(primary)).toBe('/api/media/products/a1b2c3-1280.webp')
  })

  it('only lists renditions the source could fill', () => {
    const srcset = buildSrcSet(primary, 900)
    expect(srcset).toContain('360w')
    expect(srcset).toContain('640w')
    expect(srcset).not.toContain('1280w')
    expect(srcset).not.toContain('1920w')
  })

  it('lists every rendition for a large source', () => {
    const srcset = buildSrcSet(primary, 1920)
    for (const width of [360, 640, 960, 1280, 1920]) {
      expect(srcset).toContain(`${width}w`)
    }
  })

  it('always emits at least one candidate, even for a tiny source', () => {
    expect(buildSrcSet(primary, 200)).toContain('200w')
  })

  it('switches format without touching the path structure', () => {
    expect(buildSrcSet(primary, 640, 'avif')).toContain('.avif')
    expect(buildSrcSet(primary, 640, 'webp')).toContain('.webp')
  })

  it('derives the JPEG fallback', () => {
    expect(jpegFallbackUrl(primary)).toBe('/api/media/products/a1b2c3.jpg')
  })

  it('enumerates every rendition for deletion', () => {
    const paths = renditionPaths(primary)
    expect(paths).toContain('products/a1b2c3.jpg')
    expect(paths).toContain('products/a1b2c3-1920.avif')
    expect(paths).toContain('products/a1b2c3-360.webp')
  })
})

describe('contentTypeFor', () => {
  it('maps known image extensions', () => {
    expect(contentTypeFor('x.webp')).toBe('image/webp')
    expect(contentTypeFor('x.AVIF')).toBe('image/avif')
    expect(contentTypeFor('x.jpg')).toBe('image/jpeg')
  })

  it('returns null for anything else — the handler 404s rather than guessing', () => {
    expect(contentTypeFor('x.php')).toBeNull()
    expect(contentTypeFor('x.html')).toBeNull()
    expect(contentTypeFor('x.svg')).toBeNull()
    expect(contentTypeFor('noextension')).toBeNull()
  })
})

describe('colour', () => {
  it('validates hex format strictly', () => {
    expect(isValidHex('#4A171E')).toBe(true)
    expect(isValidHex('#4a171e')).toBe(true)
    expect(isValidHex('4A171E')).toBe(false)
    expect(isValidHex('#4A171')).toBe(false)
    expect(isValidHex('red')).toBe(false)
  })

  it('mixes toward the target', () => {
    expect(mix('#000000', '#FFFFFF', 0)).toBe('#000000')
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#ffffff')
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080')
  })

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 1)
  })

  it('grades contrast against WCAG thresholds', () => {
    expect(contrastGrade(21)).toBe('AAA')
    expect(contrastGrade(5)).toBe('AA')
    expect(contrastGrade(3.5)).toBe('AA-large')
    expect(contrastGrade(1.5)).toBe('fail')
  })

  it('picks the readable foreground for a background', () => {
    expect(readableOn('#4A171E', '#4E3527')).toBe('#FFFFFF')
    expect(readableOn('#EDE6DC', '#4E3527')).toBe('#4E3527')
  })

  it('keeps the default palette readable', () => {
    const ratio = contrastRatio(DEFAULT_THEME.textDeep, DEFAULT_THEME.background)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('emits every token the stylesheet expects', () => {
    const css = themeToCss({ ...DEFAULT_THEME })

    for (const token of [
      '--c-bg',
      '--c-accent',
      '--c-text',
      '--c-surface',
      '--c-border',
      '--c-btn-bg',
      '--c-btn-text',
      '--c-success',
      '--c-danger',
    ]) {
      expect(css, token).toContain(token)
    }
  })

  it('keeps semantic colours independent of the brand accent', () => {
    const orchid = themeToCss({ ...DEFAULT_THEME })
    const green = themeToCss({ ...DEFAULT_THEME, accentPrimary: '#00FF00' })

    const dangerOf = (css: string) => css.match(/--c-danger:([^;]+)/)?.[1]
    expect(dangerOf(orchid)).toBe(dangerOf(green))
  })
})
