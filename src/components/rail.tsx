'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { SectionHeading } from './ui'

export function Rail({
  children,
  label,
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode
  label: string
  title: string
  subtitle?: string | null
  action?: { label: string; href: string }
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return

    const offset = Math.abs(el.scrollLeft)
    const max = el.scrollWidth - el.clientWidth

    setAtStart(offset <= 1)
    setAtEnd(max <= 1 || offset >= max - 2)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    measure()
    el.addEventListener('scroll', measure, { passive: true })

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)

    return () => {
      el.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [measure])

  const step = (towardEnd: boolean) => {
    const el = ref.current
    if (!el) return

    const rtl = getComputedStyle(el).direction === 'rtl'
    const distance = el.clientWidth * 0.82
    const sign = (towardEnd ? 1 : -1) * (rtl ? -1 : 1)

    el.scrollBy({ left: sign * distance, behavior: 'smooth' })
  }

  const scrollable = !(atStart && atEnd)

  return (
    <>
      <SectionHeading title={title} subtitle={subtitle} action={action}>
        {scrollable && (
          <div className="hidden gap-2 md:flex">
            <RailButton
              label={`قبلی در ${label}`}
              disabled={atStart}
              onClick={() => step(false)}
              direction="start"
            />
            <RailButton
              label={`بعدی در ${label}`}
              disabled={atEnd}
              onClick={() => step(true)}
              direction="end"
            />
          </div>
        )}
      </SectionHeading>

      <div
        ref={ref}
        role="group"
        aria-label={label}
        tabIndex={0}
        className="rail rail-bleed focus-visible:outline-offset-2"
      >
        {children}
      </div>
    </>
  )
}

function RailButton({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  direction: 'start' | 'end'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-on-accent disabled:opacity-20 disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-ink-muted"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mirror-rtl"
      >
        <path d={direction === 'start' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  )
}
