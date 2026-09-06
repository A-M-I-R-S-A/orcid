import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const CSS = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

function token(name: string, scope = CSS): string {
  const pattern = new RegExp(`--color-${name}:\\s*(?:var\\([^,]+,\\s*)?(#[0-9a-fA-F]{6})`)
  const hex = scope.match(pattern)?.[1]
  if (!hex) throw new Error(`--color-${name} not found — has the token been renamed?`)
  return hex.toLowerCase()
}

const DARK_SCOPE = (() => {
  const start = CSS.indexOf('.on-dark {')
  expect(start, '.on-dark scope missing').toBeGreaterThan(-1)
  return CSS.slice(start, CSS.indexOf('}', start))
})()

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

describe('light palette', () => {
  const bg = token('bg')
  const surface = token('surface')

  it.each([
    ['ink', 'body text'],
    ['ink-muted', 'secondary text — struck prices, dates, review counts'],
    ['accent', 'buttons and the brand mark'],
    ['accent-2', 'every link and hover state on the site'],
  ])('%s clears AA on both light grounds (%s)', (name) => {
    const colour = token(name)
    expect(contrast(colour, bg), `${name} on --color-bg`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(colour, surface), `${name} on --color-surface`).toBeGreaterThanOrEqual(4.5)
  })

  it('documents ink-subtle as decoration, not text', () => {
    const subtle = token('ink-subtle')
    expect(
      contrast(subtle, bg),
      'ink-subtle now passes AA — it has become ink-muted; collapse the two rather than keeping a step that no longer differs',
    ).toBeLessThan(4.5)
    expect(contrast(subtle, bg)).toBeGreaterThan(2.5)
  })
})

describe('dark passage', () => {
  const bg = token('bg', DARK_SCOPE)

  it('is a near-black, not a mid grey', () => {
    expect(luminance(bg)).toBeLessThan(0.05)
  })

  it.each([['ink'], ['ink-muted'], ['ink-subtle'], ['accent'], ['accent-2']])(
    '%s clears AA on the dark ground',
    (name) => {
      expect(contrast(token(name, DARK_SCOPE), bg)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('recolours the accent, because the house maroon disappears on black', () => {
    expect(token('accent', DARK_SCOPE)).not.toBe(token('accent'))
  })
})

describe('the accent band', () => {
  it('carries white type', () => {
    expect(contrast(token('on-accent'), token('accent'))).toBeGreaterThanOrEqual(4.5)
  })
})
