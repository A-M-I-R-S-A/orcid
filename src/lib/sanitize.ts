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
  // Enamad issues a complete embed snippet. Its markup (including scripts and
  // non-standard attributes) is contractual, so it must reach the page byte-for-byte.
  // This value is editable only by administrators with settings.enamad permission.
  return dirty
}

export function stripHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/\s+/g, ' ')
    .trim()
}
