import { describe, expect, it } from 'vitest'

import { safePublicHref } from '@/lib/public-url'

describe('public links', () => {
  it('allows HTTPS and clean internal paths', () => {
    expect(safePublicHref('https://example.com/path')).toBe('https://example.com/path')
    expect(safePublicHref('/products', true)).toBe('/products')
  })

  it('rejects executable, protocol-relative and credential-bearing links', () => {
    expect(safePublicHref('javascript:alert(1)', true)).toBeNull()
    expect(safePublicHref('//evil.example', true)).toBeNull()
    expect(safePublicHref('https://user:pass@example.com')).toBeNull()
  })
})
