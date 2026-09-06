import { describe, expect, it } from 'vitest'

import {
  BANNER_KINDS,
  DEFAULT_BANNER,
  BANNER_ALIGN_CLASS,
  BANNER_HEIGHT_CLASS,
  BANNER_POSITION_CLASS,
  BANNER_VEIL_CLASS,
  bannerImageStyle,
  isBannerKind,
  parseBannerSettings,
} from '@/lib/banner'

describe('parseBannerSettings', () => {
  it('returns the defaults for an absent or empty config', () => {
    expect(parseBannerSettings(null)).toEqual(DEFAULT_BANNER)
    expect(parseBannerSettings(undefined)).toEqual(DEFAULT_BANNER)
    expect(parseBannerSettings({})).toEqual(DEFAULT_BANNER)
  })

  it('keeps values that are in the allowed set', () => {
    const settings = parseBannerSettings({
      eyebrow: 'کالکشن پاییز',
      align: 'center',
      position: 'top',
      tone: 'dark',
      veil: 'light',
      overlay: 64,
      height: 'compact',
      focalX: 20,
      focalY: 80,
      zoom: 140,
      blur: 25,
      ctaStyle: 'link',
      header: 'solid',
    })

    expect(settings).toEqual({
      eyebrow: 'کالکشن پاییز',
      align: 'center',
      position: 'top',
      tone: 'dark',
      veil: 'light',
      overlay: 64,
      height: 'compact',
      focalX: 20,
      focalY: 80,
      zoom: 140,
      blur: 25,
      ctaStyle: 'link',
      header: 'solid',
    })
  })

  it('falls back rather than passing an unknown value through to a class name', () => {
    const settings = parseBannerSettings({
      align: 'diagonal',
      position: 'sideways',
      tone: 'chartreuse',
      veil: 'transparent',
      height: 'enormous',
      ctaStyle: 'explode',
      header: 'floating',
    })

    expect(settings.align).toBe(DEFAULT_BANNER.align)
    expect(settings.position).toBe(DEFAULT_BANNER.position)
    expect(settings.tone).toBe(DEFAULT_BANNER.tone)
    expect(settings.veil).toBe(DEFAULT_BANNER.veil)
    expect(settings.height).toBe(DEFAULT_BANNER.height)
    expect(settings.ctaStyle).toBe(DEFAULT_BANNER.ctaStyle)
    expect(settings.header).toBe(DEFAULT_BANNER.header)
  })

  it('clamps the numbers that reach a style attribute', () => {
    expect(parseBannerSettings({ overlay: 400 }).overlay).toBe(100)
    expect(parseBannerSettings({ overlay: -50 }).overlay).toBe(0)
    expect(parseBannerSettings({ focalX: 1e9, focalY: -1 })).toMatchObject({
      focalX: 100,
      focalY: 0,
    })
  })

  it('clamps zoom to its own range, not the shared one', () => {
    expect(parseBannerSettings({ zoom: 40 }).zoom).toBe(100)
    expect(parseBannerSettings({ zoom: 900 }).zoom).toBe(200)
    expect(parseBannerSettings({ zoom: 150 }).zoom).toBe(150)
  })

  it('refuses non-numeric and injected values', () => {
    expect(parseBannerSettings({ overlay: '50%; background: url(evil)' }).overlay).toBe(
      DEFAULT_BANNER.overlay,
    )
    expect(parseBannerSettings({ focalX: 'left' }).focalX).toBe(DEFAULT_BANNER.focalX)
    expect(parseBannerSettings({ overlay: Number.NaN }).overlay).toBe(DEFAULT_BANNER.overlay)
    expect(parseBannerSettings({ overlay: Infinity }).overlay).toBe(DEFAULT_BANNER.overlay)
  })

  it('treats a blank eyebrow as absent and caps a long one', () => {
    expect(parseBannerSettings({ eyebrow: '   ' }).eyebrow).toBe(DEFAULT_BANNER.eyebrow)
    expect(parseBannerSettings({ eyebrow: 42 }).eyebrow).toBe(DEFAULT_BANNER.eyebrow)
    expect(parseBannerSettings({ eyebrow: 'ب'.repeat(200) }).eyebrow).toHaveLength(80)
  })

  it('darkens by default, including for a row written before the setting existed', () => {
    expect(DEFAULT_BANNER.veil).toBe('dark')
    expect(parseBannerSettings({ tone: 'dark', overlay: 44 }).veil).toBe('dark')
    expect(parseBannerSettings({ tone: 'light', overlay: 44 }).veil).toBe('dark')
  })

  it('keeps the veil independent of the type colour', () => {
    expect(parseBannerSettings({ tone: 'light', veil: 'light' })).toMatchObject({
      tone: 'light',
      veil: 'light',
    })
  })

  it('survives a config that is not an object at all', () => {
    expect(parseBannerSettings('nope')).toEqual(DEFAULT_BANNER)
    expect(parseBannerSettings(7)).toEqual(DEFAULT_BANNER)
  })
})

describe('class maps', () => {
  it('covers every option of every setting', () => {
    expect(Object.keys(BANNER_HEIGHT_CLASS)).toEqual([
      'compact',
      'standard',
      'tall',
      'full',
    ])
    expect(Object.keys(BANNER_ALIGN_CLASS)).toEqual(['start', 'center', 'end'])
    expect(Object.keys(BANNER_POSITION_CLASS)).toEqual(['top', 'middle', 'bottom'])
    expect(Object.keys(BANNER_VEIL_CLASS)).toEqual(['dark', 'light'])

    for (const value of [
      ...Object.values(BANNER_HEIGHT_CLASS),
      ...Object.values(BANNER_ALIGN_CLASS),
      ...Object.values(BANNER_POSITION_CLASS),
      ...Object.values(BANNER_VEIL_CLASS),
    ]) {
      expect(value).toBeTruthy()
      expect(value).not.toContain('${')
    }
  })

  it('sizes every hero against the viewport, on phones too', () => {
    for (const value of Object.values(BANNER_HEIGHT_CLASS)) {
      expect(value, 'every height needs an unprefixed viewport height').toMatch(
        /(^|\s)h-\[\d+svh\]/,
      )
      expect(value, 'vh is wrong on a phone — svh').not.toMatch(/\d+vh\]/)
    }
  })

  it('positions vertically, which only works on a column', () => {
    expect(BANNER_POSITION_CLASS.top).toContain('justify-start')
    expect(BANNER_POSITION_CLASS.middle).toContain('justify-center')
    expect(BANNER_POSITION_CLASS.bottom).toContain('justify-end')
  })

})

describe('bannerImageStyle', () => {
  const at = (over: Partial<typeof DEFAULT_BANNER> = {}) =>
    bannerImageStyle({ ...DEFAULT_BANNER, ...over })

  it('pins the zoom to the focal point, not the centre', () => {
    const style = at({ focalX: 20, focalY: 80, zoom: 150 })
    expect(style.objectPosition).toBe('20% 80%')
    expect(style.transformOrigin).toBe('20% 80%')
    expect(style.transform).toBe('scale(1.5)')
  })

  it('is inert at the defaults', () => {
    const style = at()
    expect(style.transform).toBe('scale(1)')
    expect(style.filter).toBeUndefined()
  })

  it('scales past the frame whenever it blurs', () => {
    const blurred = at({ blur: 100 })
    expect(blurred.filter).toBe('blur(28px)')
    expect(Number(/scale\(([\d.]+)\)/.exec(blurred.transform)![1])).toBeGreaterThan(1.1)

    const slight = at({ blur: 20 })
    expect(slight.filter).toBe('blur(6px)')
    expect(Number(/scale\(([\d.]+)\)/.exec(slight.transform)![1])).toBeGreaterThan(1)
  })

  it('compounds zoom and blur rather than letting one win', () => {
    const both = at({ zoom: 150, blur: 100 })
    const scale = Number(/scale\(([\d.]+)\)/.exec(both.transform)![1])
    expect(scale).toBeGreaterThan(1.5)
  })

  it('emits no filter when there is no blur, rather than blur(0px)', () => {
    expect(at({ blur: 0 }).filter).toBeUndefined()
  })

  it('rounds the scale instead of shipping fifteen decimal places', () => {
    expect(at({ blur: 33 }).transform).toMatch(/^scale\(\d(\.\d{1,3})?\)$/)
  })
})

describe('banner kinds', () => {
  it('is the hero and the marketing band, and nothing else', () => {
    expect([...BANNER_KINDS]).toEqual(['hero', 'promo_banner'])
  })

  it('refuses the section kinds that render no image', () => {
    for (const kind of ['categories', 'featured_products', 'brand_story', 'blog_teaser']) {
      expect(isBannerKind(kind), `${kind} must not accept art direction`).toBe(false)
    }
  })

  it('accepts both banners', () => {
    expect(isBannerKind('hero')).toBe(true)
    expect(isBannerKind('promo_banner')).toBe(true)
  })
})
