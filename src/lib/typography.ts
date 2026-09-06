import 'server-only'

import { getNamespace } from './settings'

export interface FontDefinition {
  key: string
  label: string
  cssVar: string
  stack: string
  bodyEligible: boolean
  note?: string
}

export const AVAILABLE_FONTS: FontDefinition[] = [
  {
    key: 'vazirmatn',
    label: 'وزیرمتن',
    cssVar: '--font-vazirmatn',
    stack: "var(--font-vazirmatn), 'Vazirmatn', Tahoma, sans-serif",
    bodyEligible: true,
    note: 'وزن‌های متنوع، مناسب متن و جدول و قیمت',
  },
  {
    key: 'lalezar',
    label: 'لاله‌زار',
    cssVar: '--font-lalezar',
    stack: "var(--font-lalezar), 'Lalezar', Tahoma, sans-serif",
    bodyEligible: false,
    note: 'تک‌وزن و نمایشی — تنها برای عناوین و برندینگ',
  },
]

export const DEFAULT_TYPOGRAPHY = {
  headingFont: 'lalezar',
  bodyFont: 'vazirmatn',
  baseSize: '16',
  scale: 'default',
} as const

export interface TypographySettings {
  headingFont: string
  bodyFont: string
  baseSize: number
  scale: 'compact' | 'default' | 'spacious'
}

export function findFont(key: string): FontDefinition | undefined {
  return AVAILABLE_FONTS.find((f) => f.key === key)
}

export const bodyEligibleFonts = () => AVAILABLE_FONTS.filter((f) => f.bodyEligible)

export async function getTypography(): Promise<TypographySettings> {
  const stored = await getNamespace('typography')

  const headingKey = stored.headingFont ?? DEFAULT_TYPOGRAPHY.headingFont
  const bodyKey = stored.bodyFont ?? DEFAULT_TYPOGRAPHY.bodyFont

  const heading = findFont(headingKey) ?? findFont(DEFAULT_TYPOGRAPHY.headingFont)!
  const bodyCandidate = findFont(bodyKey)
  const body =
    bodyCandidate?.bodyEligible ? bodyCandidate : findFont(DEFAULT_TYPOGRAPHY.bodyFont)!

  const baseSize = Number(stored.baseSize ?? DEFAULT_TYPOGRAPHY.baseSize)
  const scale = (stored.scale ?? DEFAULT_TYPOGRAPHY.scale) as TypographySettings['scale']

  return {
    headingFont: heading.key,
    bodyFont: body.key,
    baseSize: Number.isFinite(baseSize) && baseSize >= 14 && baseSize <= 20 ? baseSize : 16,
    scale: ['compact', 'default', 'spacious'].includes(scale) ? scale : 'default',
  }
}

const SCALE_RATIOS = {
  compact: 1.18,
  default: 1.25,
  spacious: 1.333,
} as const

export function typographyToCss(settings: TypographySettings): string {
  const heading = findFont(settings.headingFont) ?? AVAILABLE_FONTS[0]!
  const body = findFont(settings.bodyFont) ?? AVAILABLE_FONTS[0]!

  const r = SCALE_RATIOS[settings.scale]
  const base = settings.baseSize

  const step = (n: number) => `${(base * r ** n).toFixed(2)}px`

  return [
    `--font-heading:${heading.stack}`,
    `--font-body:${body.stack}`,
    `--fs-base:${base}px`,
    `--fs-xs:${(base / r).toFixed(2)}px`,
    `--fs-sm:${(base / Math.sqrt(r)).toFixed(2)}px`,
    `--fs-md:${step(1)}`,
    `--fs-lg:${step(2)}`,
    `--fs-xl:${step(3)}`,
    `--fs-2xl:${step(4)}`,
    `--fs-3xl:${step(5)}`,
  ].join(';')
}
