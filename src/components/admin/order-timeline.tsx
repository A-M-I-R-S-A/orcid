import type { TimelineEvent } from '@/modules/orders/queries'
import { formatJalaliDateTime } from '@/lib/jalali'

const KIND_TONE: Record<TimelineEvent['kind'], string> = {
  created: 'border-line-strong bg-surface',
  status: 'border-accent-2 bg-accent-2',
  payment: 'border-success bg-success',
  note: 'border-line-strong bg-surface',
  sms: 'border-warning bg-warning',
}

export function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-subtle">رویدادی ثبت نشده است.</p>
  }

  return (
    <ol className="relative space-y-5">
      <span
        aria-hidden="true"
        className="absolute top-2 bottom-2 start-[5px] w-px bg-line"
      />

      {events.map((event, index) => (
        <li key={`${event.at}-${index}`} className="relative flex gap-4 ps-6">
          <span
            aria-hidden="true"
            className={`absolute start-0 top-1.5 h-[11px] w-[11px] rounded-full border ${KIND_TONE[event.kind]}`}
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">{event.title}</p>

            {event.detail && (
              <p className="mt-0.5 text-xs text-ink-muted break-words">{event.detail}</p>
            )}

            <p className="mt-1 text-xs text-ink-subtle nums">
              {formatJalaliDateTime(event.at)}
              {event.actor && <span className="ms-2 text-ink-muted">· {event.actor}</span>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
