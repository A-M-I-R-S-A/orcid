import { describe, expect, it } from 'vitest'

import { sanitizeEnamad } from '@/lib/sanitize'

describe('enamad badge sanitiser', () => {
  const realistic =
    '<a referrerpolicy="origin" target="_blank" href="https://trustseal.enamad.ir/?id=1&Code=ABC">' +
    '<img referrerpolicy="origin" src="https://trustseal.enamad.ir/logo.aspx?id=1&Code=ABC" alt="نماد" code="ABC"></a>'

  it('keeps the badge markup Enamad actually issues', () => {
    const clean = sanitizeEnamad(realistic)
    expect(clean).toContain('trustseal.enamad.ir')
    expect(clean).toContain('code="ABC"')
    expect(clean).toContain('referrerpolicy="origin"')
  })

  it('forces lazy loading so a slow badge host cannot stall the page', () => {
    const clean = sanitizeEnamad(realistic)
    expect(clean).toContain('loading="lazy"')
    expect(clean).toContain('decoding="async"')
  })

  it('applies loading exactly once', () => {
    const clean = sanitizeEnamad('<img src="https://x.example/a.png">')
    expect(clean.match(/loading=/g)).toHaveLength(1)
  })

  it('pairs target=_blank with rel=noopener', () => {
    const clean = sanitizeEnamad('<a target="_blank" href="https://x.example/">x</a>')
    expect(clean).toContain('target="_blank"')
    expect(clean).toContain('noopener')
  })

  it('refuses a code that is not an opaque identifier', () => {
    const clean = sanitizeEnamad('<img src="https://x.example/a.png" code="\" onerror=alert(1) x=\"">')
    expect(clean).not.toContain('onerror')
    expect(clean).not.toContain('alert')
  })

  it('refuses a referrerpolicy outside the enumerated set', () => {
    const clean = sanitizeEnamad('<img src="https://x.example/a.png" referrerpolicy="javascript:alert(1)">')
    expect(clean).not.toContain('javascript')
  })

  it('strips script, iframe and event handlers', () => {
    const hostile =
      '<script>alert(1)</script><iframe src="https://evil.example"></iframe>' +
      '<img src="https://x.example/a.png" onerror="alert(1)" onload="alert(2)">'
    const clean = sanitizeEnamad(hostile)

    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('<iframe')
    expect(clean).not.toContain('onerror')
    expect(clean).not.toContain('onload')
  })

  it('refuses a javascript: URL', () => {
    const clean = sanitizeEnamad('<a href="javascript:alert(1)">x</a>')
    expect(clean).not.toContain('javascript:')
  })
})
