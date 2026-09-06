import 'server-only'

import { DEFAULT_THEME, type ThemeTokens, isValidHex } from './color'
import { getNamespace } from './settings'

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
    if (value && isValidHex(value)) theme[key] = value
  }

  return theme
}
