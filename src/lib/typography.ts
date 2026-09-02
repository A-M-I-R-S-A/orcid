import 'server-only'

import { getNamespace } from './settings'

/**
 * Typography.
 *
 * Both faces are loaded through next/font at build time and exposed as CSS
 * variables, so the administrator's choice is a runtime remap of
 * --font-heading / --font-body onto an already-self-hosted face. No network
 * request, no layout shift, no rebuild. §8 / §49.
 */

export interface FontDefinition {
  key: string
  label: string
  /** The CSS variable next/font binds this family to. */
  cssVar: string
  stack: string
  /**
   * Display-only faces have a single weight and no italic. They cannot carry a
   * type hierarchy and hurt readability at body sizes, so the font selector
   * refuses to offer them for the body role — §8's "where it creates visual
   * value, rather than forcing it on every paragraph", enforced by the UI
   * rather than left to discipline.
   */
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
  // A display-only face stored for the body role — through a hand-edited
  // database row, say — is corrected rather than honoured.
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

/** Emits the font and type-scale custom properties for inlining in <head>. */
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
