import { describe, expect, it } from 'vitest'

import { sanitizeEnamad } from '@/lib/sanitize'

describe('enamad badge sanitiser', () => {
  const realistic =
    '<a referrerpolicy="origin" target="_blank" href="https://trustseal.enamad.ir/?id=1&Code=ABC">' +
    '<img referrerpolicy="origin" src="https://trustseal.enamad.ir/logo.aspx?id=1&Code=ABC" alt="نماد" code="ABC"></a>'

  it('returns Enamad markup exactly as supplied', () => {
    const clean = sanitizeEnamad(realistic)
    expect(clean).toBe(realistic)
  })

  it('does not add or remove scripts, attributes, or whitespace', () => {
    const issued = '\n<script src="https://trustseal.enamad.ir/script.js"></script>\n<img code="ABC" referrerpolicy="origin">\n'
    expect(sanitizeEnamad(issued)).toBe(issued)
  })
})
