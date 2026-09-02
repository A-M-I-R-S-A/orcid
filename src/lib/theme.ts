import 'server-only'

import { DEFAULT_THEME, type ThemeTokens, isValidHex } from './color'
import { getNamespace } from './settings'

/**
 * Theme loading.
 *
 * The colour maths, tokens and CSS emission live in lib/color.ts, which is
 * import-safe from client components (the admin theme editor computes contrast
 * live). This module is the server half: it reads the administrator's stored
 * values and validates them.
 */

export {
  DEFAULT_THEME,
  THEME_FIELDS,
  contrastGrade,
  contrastRatio,
  isValidHex,
  luminance,
  mix,
  readableOn,
  themeToCss,
  type ThemeTokens,
} from './color'

export async function getTheme(): Promise<ThemeTokens> {
  const stored = await getNamespace('theme')
  const theme = { ...DEFAULT_THEME } as ThemeTokens

  for (const key of Object.keys(DEFAULT_THEME) as (keyof ThemeTokens)[]) {
    const value = stored[key]
    // A malformed stored value falls back to the default rather than emitting
    // broken CSS — one bad hex must not take the whole site's styling down.
    if (value && isValidHex(value)) theme[key] = value
  }

  return theme
}
