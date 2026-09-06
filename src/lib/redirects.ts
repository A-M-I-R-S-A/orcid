const DEFAULT_TARGET = '/account'

const NEVER = ['/login', '/register', '/forgot-password']

export function safeNext(value: string | undefined | null, fallback = DEFAULT_TARGET): string {
  if (!value) return fallback

  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback

  if (/[\x00-\x1f\x7f]/.test(value)) return fallback

  const path = value.split(/[?#]/)[0] ?? ''
  if (NEVER.some((p) => path === p || path.startsWith(`${p}/`))) return fallback

  return value
}
