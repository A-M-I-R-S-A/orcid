/**
 * Colour tokens and colour maths — pure, no `server-only`.
 *
 * Separated from lib/theme.ts because the admin theme editor is a CLIENT
 * component that computes contrast ratios live as an administrator drags a
 * colour picker. `theme.ts` reads settings from the database and must stay
 * server-side; this half is arithmetic and belongs to both.
 */

/** The Orchid palette from the specification. §6. */
export const DEFAULT_THEME = {
  background: '#EDE6DC',
  backgroundSecondary: '#D9B896',
  accentPrimary: '#4A171E',
  accentSecondary: '#A15530',
  accentTertiary: '#C4A79A',
  textDeep: '#4E3527',
  paper: '#F2EDE6',
} as const

export type ThemeTokens = Record<keyof typeof DEFAULT_THEME, string>

export const THEME_FIELDS: {
  key: keyof typeof DEFAULT_THEME
  label: string
  hint: string
}[] = [
  { key: 'background', label: 'پس‌زمینه اصلی', hint: 'رنگ زمینه کل سایت' },
  { key: 'backgroundSecondary', label: 'پس‌زمینه ثانویه', hint: 'بخش‌های متمایز و بنرها' },
  { key: 'paper', label: 'سطح کارت‌ها', hint: 'زمینه کارت محصول و فرم‌ها' },
  { key: 'accentPrimary', label: 'رنگ اصلی', hint: 'دکمه‌ها، لینک‌های مهم، عناوین' },
  { key: 'accentSecondary', label: 'رنگ مکمل', hint: 'برچسب تخفیف و تأکیدهای فرعی' },
  { key: 'accentTertiary', label: 'رنگ سوم', hint: 'حاشیه‌ها و جداکننده‌ها' },
  { key: 'textDeep', label: 'رنگ متن', hint: 'متن اصلی و عناوین' },
]

const HEX = /^#[0-9a-fA-F]{6}$/

export function isValidHex(value: string): boolean {
  return HEX.test(value)
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function mix(a: string, b: string, weight: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const w = Math.max(0, Math.min(1, weight))
  return rgbToHex(r1 + (r2 - r1) * w, g1 + (g2 - g1) * w, b1 + (b2 - b1) * w)
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Relative luminance, per WCAG. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Picks readable foreground text for a given background.
 * Used for button labels, so an administrator choosing a pale accent does not
 * silently produce white-on-cream text nobody can read.
 */
export function readableOn(background: string, dark: string, light = '#FFFFFF'): string {
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light
}

export function contrastGrade(ratio: number): 'AAA' | 'AA' | 'AA-large' | 'fail' {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA-large'
  return 'fail'
}

/**
 * Derives the full semantic token set and returns it as CSS custom properties
 * for inlining in <head>. Inline rather than a stylesheet request because
 * these values change per settings-save, not per build — and a blocking
 * round-trip for them would sit on the critical path and hurt LCP.
 */
export function themeToCss(theme: ThemeTokens): string {
  const {
    background,
    backgroundSecondary,
    accentPrimary,
    accentSecondary,
    accentTertiary,
    textDeep,
    paper,
  } = theme

  const tokens: Record<string, string> = {
    // Author-facing seven
    '--c-bg': background,
    '--c-bg-secondary': backgroundSecondary,
    '--c-accent': accentPrimary,
    '--c-accent-2': accentSecondary,
    '--c-accent-3': accentTertiary,
    '--c-text': textDeep,
    '--c-paper': paper,

    // Derived surfaces
    '--c-surface': paper,
    '--c-surface-raised': mix(paper, '#FFFFFF', 0.5),
    '--c-surface-sunken': mix(background, textDeep, 0.04),

    // Derived text
    '--c-text-muted': mix(textDeep, background, 0.35),
    '--c-text-subtle': mix(textDeep, background, 0.55),
    '--c-text-on-accent': readableOn(accentPrimary, textDeep),
    '--c-text-on-accent-2': readableOn(accentSecondary, textDeep),

    // Borders
    '--c-border': mix(accentTertiary, background, 0.45),
    '--c-border-strong': mix(accentTertiary, textDeep, 0.25),
    '--c-border-focus': accentSecondary,

    // Buttons
    '--c-btn-bg': accentPrimary,
    '--c-btn-text': readableOn(accentPrimary, textDeep),
    '--c-btn-hover': mix(accentPrimary, '#000000', 0.15),
    '--c-btn-secondary-bg': 'transparent',
    '--c-btn-secondary-border': accentPrimary,

    // Semantic — deliberately independent of the brand accent, so a theme
    // change can never make "out of stock" read as "in stock".
    '--c-success': '#4A6B4E',
    '--c-success-bg': '#E4EBE1',
    '--c-warning': '#96671C',
    '--c-warning-bg': '#F3E8D2',
    '--c-danger': '#8C2F39',
    '--c-danger-bg': '#F2E0DF',
    '--c-info': mix(accentSecondary, background, 0.2),

    // Effects
    '--c-shadow': hexToRgba(textDeep, 0.1),
    '--c-shadow-strong': hexToRgba(textDeep, 0.18),
    '--c-overlay': hexToRgba(textDeep, 0.55),
  }

  return Object.entries(tokens)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
}
