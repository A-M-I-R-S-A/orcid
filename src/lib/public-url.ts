export function safePublicHref(value: string | null | undefined, allowRelative = false): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null
  } catch {
    return null
  }
}
