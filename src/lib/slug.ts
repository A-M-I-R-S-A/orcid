/**
 * Slugs.
 *
 * Persian slugs, stored decoded and emitted percent-encoded:
 *   /product/سوتین-بدون-فنر
 *
 * Search engines handle this correctly and Persian shoppers see a readable,
 * shareable URL. Latin transliteration would produce URLs no customer can
 * read. Planning package §H.
 */

/** Persian/Arabic letter range plus Latin alphanumerics. */
const ALLOWED = /[^ء-غف-يپچژکگی٠-٩۰-۹a-z0-9\s-]/gi

export function slugify(input: string): string {
  if (!input) return ''

  return input
    .normalize('NFC')
    .trim()
    .toLowerCase()
    // ZWNJ becomes a hyphen so compounds stay readable in the URL.
    .replace(/‌/g, '-')
    .replace(ALLOWED, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180)
}

/**
 * Appends a numeric suffix until the slug is free.
 * `exists` is injected so this stays a pure function that unit tests can drive
 * without a database.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'item'

  if (!(await exists(root))) return root

  for (let i = 2; i < 200; i++) {
    const candidate = `${root}-${i}`
    if (!(await exists(candidate))) return candidate
  }

  // Pathological case — fall back to something guaranteed free.
  return `${root}-${Date.now().toString(36)}`
}

/**
 * Encodes a slug for use in a URL path. Persian characters become
 * percent-escapes; the hyphens stay readable.
 */
export function encodeSlug(slug: string): string {
  return encodeURIComponent(slug)
}
