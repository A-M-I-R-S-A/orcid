/**
 * Jalali (Persian) dates.
 *
 * Built on Intl with the `persian` calendar rather than hand-rolled arithmetic.
 * Leap-year and month-length rules in the Solar Hijri calendar are genuinely
 * intricate, and off-by-one errors around midnight are a classic failure —
 * ICU's implementation is tested by more people than ours ever would be.
 *
 * Timestamps are stored UTC and converted only at render, with the timezone
 * pinned to Asia/Tehran so a server in another zone cannot shift a date.
 */

const TZ = 'Asia/Tehran'
const LOCALE = 'fa-IR-u-ca-persian'

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

const cache = new Map<string, Intl.DateTimeFormat>()

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options)
  let f = cache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, ...options })
    cache.set(key, f)
  }
  return f
}

/** ۱۰ شهریور ۱۴۰۵ */
export function formatJalali(value: Date | string | number): string {
  return formatter({ dateStyle: 'long' }).format(toDate(value))
}

/** ۱۴۰۵/۰۶/۱۰ */
export function formatJalaliShort(value: Date | string | number): string {
  return formatter({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(toDate(value))
}

/** ۱۰ شهریور ۱۴۰۵ ساعت ۱۳:۳۰ */
export function formatJalaliDateTime(value: Date | string | number): string {
  const d = toDate(value)
  const date = formatter({ dateStyle: 'long' }).format(d)
  const time = formatter({ hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${date} ساعت ${time}`
}

/** ۱۳:۳۰ */
export function formatJalaliTime(value: Date | string | number): string {
  return formatter({ hour: '2-digit', minute: '2-digit', hour12: false }).format(toDate(value))
}

/** Numeric parts, useful for order numbers and grouping. */
export function jalaliParts(value: Date | string | number): {
  year: number
  month: number
  day: number
} {
  const parts = formatter({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    numberingSystem: 'latn',
  }).formatToParts(toDate(value))

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)

  return { year: get('year'), month: get('month'), day: get('day') }
}

/** The Jalali year, used in order numbers such as ORC-1405-000042. */
export function jalaliYear(value: Date | string | number = new Date()): number {
  return jalaliParts(value).year
}

/**
 * Relative time in Persian: «۳ روز پیش».
 * Falls back to an absolute date past a month, where "۵ هفته پیش" stops being
 * more useful than the date itself.
 */
export function relativeTime(value: Date | string | number): string {
  const d = toDate(value)
  const diffMs = Date.now() - d.getTime()
  const diffSec = Math.round(diffMs / 1000)

  if (diffSec < 60) return 'لحظاتی پیش'

  const rtf = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' })

  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return rtf.format(-diffMin, 'minute')

  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return rtf.format(-diffHour, 'hour')

  const diffDay = Math.round(diffHour / 24)
  if (diffDay <= 30) return rtf.format(-diffDay, 'day')

  return formatJalali(d)
}

/** ISO 8601 for <time datetime> and structured data — always machine-readable. */
export function isoDate(value: Date | string | number): string {
  return toDate(value).toISOString()
}
