import 'server-only'

import DOMPurify from 'isomorphic-dompurify'

/**
 * HTML sanitisation for CMS and blog bodies. §75.
 *
 * These fields are written by authenticated administrators, so this is not
 * about distrusting the author — it is about a compromised admin session not
 * becoming stored XSS that fires for every visitor. The content is rendered
 * with dangerouslySetInnerHTML, so it must pass through here first, always.
 */

const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h2', 'h3', 'h4',
  'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small',
  'ul', 'ol', 'li',
  'blockquote', 'figure', 'figcaption',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div',
]

const ALLOWED_ATTR = [
  'href', 'target', 'rel',
  'src', 'alt', 'width', 'height', 'loading',
  'title', 'dir', 'lang',
  'colspan', 'rowspan',
  'class',
]

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Belt and braces on top of the tag allowlist.
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style'],
    // data: URIs in an href are a phishing and script vector; images are
    // served from our own media route, so nothing legitimate needs them.
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/)/i,
  })
}

/**
 * The Enamad badge is a special case: it is a third-party <a><img></a> snippet
 * that must keep the attributes Enamad's verification depends on, which the
 * general allowlist would strip.
 *
 * It is still sanitised — scripts and event handlers are removed — but the
 * tag set is narrowed to exactly what a trust badge needs, rather than widened.
 */
export function sanitizeEnamad(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['a', 'img', 'div', 'span'],
    ALLOWED_ATTR: [
      'href', 'target', 'rel',
      'src', 'alt', 'width', 'height',
      'id', 'class', 'style',
      // Enamad's own verification hooks.
      'referrerpolicy', 'code', 'cid',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    ALLOWED_URI_REGEXP: /^(?:https?:|\/)/i,
  })
}

/** Strips every tag — for meta descriptions and excerpts built from a body. */
export function stripHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/\s+/g, ' ')
    .trim()
}
