export const BANNER_KINDS = ['hero', 'promo_banner'] as const
export type BannerKind = (typeof BANNER_KINDS)[number]

export function isBannerKind(kind: string): kind is BannerKind {
  return (BANNER_KINDS as readonly string[]).includes(kind)
}

export const BANNER_ALIGNMENTS = ['start', 'center', 'end'] as const
export const BANNER_POSITIONS = ['top', 'middle', 'bottom'] as const
export const BANNER_TONES = ['light', 'dark'] as const
export const BANNER_VEILS = ['dark', 'light'] as const
export const BANNER_HEIGHTS = ['compact', 'standard', 'tall', 'full'] as const
export const BANNER_CTA_STYLES = ['outline', 'solid', 'link'] as const
export const BANNER_HEADERS = ['overlay', 'solid'] as const

export type BannerAlign = (typeof BANNER_ALIGNMENTS)[number]
export type BannerPosition = (typeof BANNER_POSITIONS)[number]
export type BannerTone = (typeof BANNER_TONES)[number]
export type BannerVeil = (typeof BANNER_VEILS)[number]
export type BannerHeight = (typeof BANNER_HEIGHTS)[number]
export type BannerCtaStyle = (typeof BANNER_CTA_STYLES)[number]
export type BannerHeader = (typeof BANNER_HEADERS)[number]

export interface BannerSettings {
  eyebrow: string
  align: BannerAlign
  position: BannerPosition
  tone: BannerTone
  veil: BannerVeil
  overlay: number
  height: BannerHeight
  focalX: number
  focalY: number
  zoom: number
  blur: number
  ctaStyle: BannerCtaStyle
  header: BannerHeader
}

export const DEFAULT_BANNER: BannerSettings = {
  eyebrow: 'مجموعه ارکید',
  align: 'start',
  position: 'bottom',
  tone: 'light',
  veil: 'dark',
  overlay: 38,
  height: 'tall',
  focalX: 50,
  focalY: 50,
  zoom: 100,
  blur: 0,
  ctaStyle: 'outline',
  header: 'overlay',
}

function oneOf<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function clamp(value: unknown, fallback: number, min = 0, max = 100): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function parseBannerSettings(config: unknown): BannerSettings {
  const raw = (config ?? {}) as Record<string, unknown>

  return {
    eyebrow:
      typeof raw.eyebrow === 'string' && raw.eyebrow.trim()
        ? raw.eyebrow.trim().slice(0, 80)
        : DEFAULT_BANNER.eyebrow,
    align: oneOf(BANNER_ALIGNMENTS, raw.align, DEFAULT_BANNER.align),
    position: oneOf(BANNER_POSITIONS, raw.position, DEFAULT_BANNER.position),
    tone: oneOf(BANNER_TONES, raw.tone, DEFAULT_BANNER.tone),
    veil: oneOf(BANNER_VEILS, raw.veil, DEFAULT_BANNER.veil),
    overlay: clamp(raw.overlay, DEFAULT_BANNER.overlay),
    height: oneOf(BANNER_HEIGHTS, raw.height, DEFAULT_BANNER.height),
    focalX: clamp(raw.focalX, DEFAULT_BANNER.focalX),
    focalY: clamp(raw.focalY, DEFAULT_BANNER.focalY),
    zoom: clamp(raw.zoom, DEFAULT_BANNER.zoom, 100, 200),
    blur: clamp(raw.blur, DEFAULT_BANNER.blur),
    ctaStyle: oneOf(BANNER_CTA_STYLES, raw.ctaStyle, DEFAULT_BANNER.ctaStyle),
    header: oneOf(BANNER_HEADERS, raw.header, DEFAULT_BANNER.header),
  }
}

const MAX_BLUR_PX = 28

export interface BannerImageStyle {
  objectPosition: string
  transformOrigin: string
  transform: string
  filter?: string
}

export function bannerImageStyle(hero: BannerSettings): BannerImageStyle {
  const blurPx = Math.round((hero.blur / 100) * MAX_BLUR_PX)

  const scale = (Math.max(hero.zoom, 100) / 100) * (1 + blurPx * 0.006)

  return {
    objectPosition: `${hero.focalX}% ${hero.focalY}%`,
    transformOrigin: `${hero.focalX}% ${hero.focalY}%`,
    transform: `scale(${Math.round(scale * 1000) / 1000})`,
    ...(blurPx > 0 ? { filter: `blur(${blurPx}px)` } : {}),
  }
}

export const BANNER_LABELS = {
  align: { start: 'راست', center: 'وسط', end: 'چپ' },
  position: { top: 'بالا', middle: 'میانه', bottom: 'پایین' },
  tone: { light: 'روشن (روی عکس تیره)', dark: 'تیره (روی عکس روشن)' },
  veil: { dark: 'تیره‌کردن عکس', light: 'روشن‌کردن عکس' },
  height: {
    compact: 'کوتاه',
    standard: 'معمولی',
    tall: 'بلند',
    full: 'تمام‌صفحه',
  },
  ctaStyle: { outline: 'خط‌دار', solid: 'تو‌پر', link: 'متنی' },
  header: { overlay: 'شناور روی عکس', solid: 'بالای عکس' },
} as const

export const BANNER_HEIGHT_CLASS: Record<BannerHeight, string> = {
  compact: 'min-h-[22rem] h-[54svh] md:min-h-[26rem] md:h-[58svh] md:max-h-[34rem]',
  standard: 'min-h-[26rem] h-[70svh] md:min-h-[32rem] md:h-[74svh] md:max-h-[44rem]',
  tall: 'min-h-[32rem] h-[88svh] md:min-h-[40rem] md:h-[86svh] md:max-h-[54rem]',
  full: 'min-h-[36rem] h-[100svh] md:min-h-[44rem] md:h-[100svh] md:max-h-[62rem]',
}

export const BANNER_ALIGN_CLASS: Record<BannerAlign, string> = {
  start: 'items-start text-start',
  center: 'items-center text-center',
  end: 'items-end text-end',
}

export const BANNER_POSITION_CLASS: Record<BannerPosition, string> = {
  top: 'justify-start pt-24 md:pt-28',
  middle: 'justify-center',
  bottom: 'justify-end pb-16 md:pb-20',
}

export const BANNER_VEIL_CLASS: Record<BannerVeil, string> = {
  dark: 'banner-veil-dark',
  light: 'banner-veil-light',
}
