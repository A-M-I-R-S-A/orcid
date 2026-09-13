import { describe, expect, it } from 'vitest'

import { sanitizeHtml } from '@/lib/sanitize'

describe('CMS HTML sanitization', () => {
  it('keeps local style blocks and inline content images', () => {
    const clean = sanitizeHtml('<style>.article-photo { border-radius: 12px; }</style><img src="/api/media/blog/photo.webp" alt="نمونه">')
    expect(clean).toContain('<style>.article-photo { border-radius: 12px; }</style>')
    expect(clean).toContain('<img src="/api/media/blog/photo.webp" alt="نمونه">')
  })

  it('removes CSS that can fetch remote content or execute legacy code', () => {
    expect(sanitizeHtml('<style>@import url(https://bad.example/a.css);</style><p>متن</p>')).toBe('<p>متن</p>')
  })
})
