import 'server-only'

import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h2', 'h3', 'h4',
  'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small',
  'ul', 'ol', 'li',
  'blockquote', 'figure', 'figcaption',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div',
  'style',
]

const ALLOWED_ATTR = [
  'href', 'target', 'rel',
  'src', 'alt', 'width', 'height', 'loading',
  'title', 'dir', 'lang',
  'colspan', 'rowspan',
  'class',
]

export function sanitizeHtml(dirty: string): string {
  const styles: string[] = []
  const content = dirty.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_whole, css: string) => {
    if (!/@import|@namespace|expression\s*\(|behavior\s*:|binding\s*:|url\s*\(/i.test(css)) {
      styles.push(`<style>${css}</style>`)
    }
    return ''
  })

  const clean = DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/)/i,
  })

  return styles.join('') + clean
}

export function sanitizeEnamad(dirty: string): string {
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['a', 'img', 'div', 'span'],
    ALLOWED_ATTR: [
      'href', 'target', 'rel',
      'src', 'alt', 'width', 'height',
      'id', 'class', 'style',
      'loading', 'decoding',
      'referrerpolicy', 'code', 'cid',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    ALLOWED_URI_REGEXP: /^(?:https?:|\/)/i,
  })

  return withBadgeAttributes(dirty, clean)
}

function withBadgeAttributes(original: string, clean: string): string {
  const lift = (attribute: string, pattern: RegExp): string | null => {
    const found = original.match(new RegExp(`\\s${attribute}\\s*=\\s*["']([^"']*)["']`, 'i'))
    const value = found?.[1]
    return value && pattern.test(value) ? value : null
  }

  const code = lift('code', /^[A-Za-z0-9_-]{1,64}$/)
  const cid = lift('cid', /^[A-Za-z0-9_-]{1,64}$/)
  const referrer = lift('referrerpolicy', /^(no-referrer|origin|unsafe-url|no-referrer-when-downgrade)$/i)

  let out = clean

  if (/\starget\s*=\s*["']_blank["']/i.test(original)) {
    out = out.replace(/<a\b(?![^>]*\starget\s*=)/gi, '<a target="_blank" rel="noopener noreferrer"')
  }

  if (referrer) {
    out = out.replace(
      new RegExp('<(a|img)\\b(?![^>]*\\sreferrerpolicy\\s*=)', 'gi'),
      `<$1 referrerpolicy="${referrer}"`,
    )
  }
  if (code) out = out.replace(/<img\b(?![^>]*\scode\s*=)/gi, `<img code="${code}"`)
  if (cid) out = out.replace(/<img\b(?![^>]*\scid\s*=)/gi, `<img cid="${cid}"`)

  return out.replace(/<img\b(?![^>]*\sloading\s*=)/gi, '<img loading="lazy" decoding="async"')
}

export function stripHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/\s+/g, ' ')
    .trim()
}
