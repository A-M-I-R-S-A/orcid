'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Horizontal shelf.
 *
 * ── Why a rail and not a grid ─────────────────────────────────────────────
 * A grid section is only as good as its item count. Four columns holding
 * three products leaves a column-wide hole that reads as a rendering fault,
 * and a young catalogue produces that shape constantly. A rail is the same
 * shape at three items and at thirty: a row that either fills the width or
 * runs past it.
 *
 * ── Why the controls are here and not in CSS ──────────────────────────────
 * Scrollbars are hidden site-wide, so a pointer user has no visible handle
 * and no obvious hint that the row moves. The arrows put that back — but only
 * when there is genuinely something to scroll to, and only for pointers.
 * Touch and keyboard already have native affordances, and a permanently
 * disabled pair of buttons is worse than no buttons at all.
 *
 * Direction is read from the computed style rather than assumed: in RTL,
 * Chromium counts `scrollLeft` down from zero into negatives, so both the
 * step and the end test have to be sign-aware, or the arrows run backwards in
 * the very language this shop is written in.
 *
 * `heading` is server-rendered and handed in as a prop, so the section title
 * and its copy stay out of the client bundle — only the scroll behaviour
 * crosses the boundary.
 */
export function Rail({
  children,
  label,
  heading,
  aside,
}: {
  children: React.ReactNode
  label: string
  heading: React.ReactNode
  aside?: React.ReactNode
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
    // 2px of slack: sub-pixel widths leave the end half a pixel short.
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
    // Just under one rail-width, so a card always survives the jump and the
    // eye has something to track between pages.
    const distance = el.clientWidth * 0.82
    const sign = (towardEnd ? 1 : -1) * (rtl ? -1 : 1)

    el.scrollBy({ left: sign * distance, behavior: 'smooth' })
  }

  const scrollable = !(atStart && atEnd)

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-9">
        {heading}

        <div className="flex items-center gap-5">
          {aside}
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
        </div>
      </div>

      <div
        ref={ref}
        role="group"
        aria-label={label}
        tabIndex={0}
        className="rail rail-center rail-bleed focus-visible:outline-offset-2"
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
      className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong text-ink transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-on-accent disabled:opacity-25 disabled:hover:border-line-strong disabled:hover:bg-transparent disabled:hover:text-ink"
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
