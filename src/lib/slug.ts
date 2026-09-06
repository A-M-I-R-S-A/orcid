const ALLOWED = /[^ء-غف-يپچژکگی٠-٩۰-۹a-z0-9\s-]/gi

export function slugify(input: string): string {
  if (!input) return ''

  return input
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/‌/g, '-')
    .replace(ALLOWED, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180)
}

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

  return `${root}-${Date.now().toString(36)}`
}

export function encodeSlug(slug: string): string {
  return encodeURIComponent(slug)
}
