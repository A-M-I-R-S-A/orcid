'use client'

import { useEffect, useRef, useState } from 'react'

export function CopyField({
  label,
  display,
  copyValue,
  dir = 'ltr',
}: {
  label: string
  display: string
  copyValue?: string
  dir?: 'ltr' | 'rtl'
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue ?? display)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    } catch {
    }
  }

  return (
    <div>
      <dt className="text-xs text-ink-muted mb-1">{label}</dt>
      <dd className="flex items-center gap-1.5">
        <span className="nums font-medium select-all truncate" dir={dir}>
          {display}
        </span>

        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md p-1 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink-muted"
          aria-label={copied ? `${label} کپی شد` : `کپی ${label}`}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-success">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 012-2h10" />
            </svg>
          )}
        </button>
      </dd>

      <span aria-live="polite" className="sr-only">
        {copied ? 'کپی شد' : ''}
      </span>
    </div>
  )
}
