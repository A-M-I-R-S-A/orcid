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

export function formatJalali(value: Date | string | number): string {
  return formatter({ dateStyle: 'long' }).format(toDate(value))
}

export function formatJalaliShort(value: Date | string | number): string {
  return formatter({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(toDate(value))
}

export function formatJalaliDateTime(value: Date | string | number): string {
  const d = toDate(value)
  const date = formatter({ dateStyle: 'long' }).format(d)
  const time = formatter({ hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${date} ساعت ${time}`
}

export function formatJalaliTime(value: Date | string | number): string {
  return formatter({ hour: '2-digit', minute: '2-digit', hour12: false }).format(toDate(value))
}

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

export function jalaliYear(value: Date | string | number = new Date()): number {
  return jalaliParts(value).year
}

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

export function isoDate(value: Date | string | number): string {
  return toDate(value).toISOString()
}
