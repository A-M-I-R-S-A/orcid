import { describe, expect, it } from 'vitest'

import { buildCsp } from '@/lib/csp'

describe('content security policy', () => {
  const base = { nonce: 'TESTNONCE==', isProduction: true, isHttps: true }

  describe('unsafe-eval', () => {
    it('is absent in production — the whole point of the policy', () => {
      expect(buildCsp(base)).not.toContain('unsafe-eval')
    })

    it('is present in development, where Fast Refresh compiles through eval()', () => {
      expect(buildCsp({ ...base, isProduction: false })).toContain(`'unsafe-eval'`)
    })

    it('never loosens script-src beyond eval, even in development', () => {
      const dev = buildCsp({ ...base, isProduction: false })
      const scriptSrc = dev.split('; ').find((d) => d.startsWith('script-src'))!
      expect(scriptSrc).not.toContain('unsafe-inline')
    })
  })

  describe('upgrade-insecure-requests', () => {
    it('is sent over https', () => {
      expect(buildCsp(base)).toContain('upgrade-insecure-requests')
    })

    it('is NOT sent over plain http', () => {
      expect(buildCsp({ ...base, isHttps: false })).not.toContain('upgrade-insecure-requests')
    })
  })

  describe('the parts that never vary', () => {
    it('carries the request nonce in script-src', () => {
      expect(buildCsp(base)).toContain(`'nonce-TESTNONCE=='`)
    })

    it('allows inline styles but not inline scripts', () => {
      const parts = Object.fromEntries(
        buildCsp(base)
          .split('; ')
          .map((d) => [d.split(' ')[0], d]),
      )

      expect(parts['style-src']).toContain(`'unsafe-inline'`)
      expect(parts['script-src']).not.toContain(`'unsafe-inline'`)
    })

    it('forbids framing and plugins outright', () => {
      const csp = buildCsp(base)
      expect(csp).toContain(`frame-ancestors 'none'`)
      expect(csp).toContain(`object-src 'none'`)
      expect(csp).toContain(`base-uri 'self'`)
      expect(csp).toContain(`form-action 'self'`)
    })

    it('emits one well-formed directive list', () => {
      const csp = buildCsp(base)
      expect(csp).not.toMatch(/;\s*;/)
      expect(csp.trim()).toBe(csp)
      for (const directive of csp.split('; ')) {
        expect(directive).toMatch(/^[a-z-]+( |$)/)
      }
    })
  })
})
