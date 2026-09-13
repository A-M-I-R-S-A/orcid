'use client'

import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { ResponsiveImage } from '@/components/media'
import { SIZE_GUIDE_HREF, SIZE_GUIDE_LABEL, type SizeGuide } from '@/lib/size-guide'
import { useSiteText } from '@/components/site-content-provider'

export function SizeGuideDialog({ guide }: { guide: SizeGuide }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const closeLabel = useSiteText('sizeGuide.close', 'بستن')
  const missing = useSiteText('sizeGuide.missing', 'تصویر راهنما هنوز بارگذاری نشده است. برای دیدن جدول اندازه‌ها صفحهٔ راهنما را باز کنید.')
  const full = useSiteText('sizeGuide.full', 'راهنمای کامل اندازه‌گیری')

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return

    const panel = panelRef.current
    panel?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        return
      }

      if (event.key !== 'Tab' || !panel) return

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, close])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="link-rule text-[13px] text-ink-muted"
      >
        {SIZE_GUIDE_LABEL}
      </button>

      <div
        className={`fixed inset-0 z-50 flex items-end justify-center p-0 transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:items-center sm:p-6 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
          onClick={close}
          aria-hidden="true"
        />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-bg outline-none transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] sm:rounded-lg ${
            open ? 'translate-y-0' : 'translate-y-6 sm:translate-y-4'
          }`}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id={titleId} className="text-lg text-ink">
              {guide.title}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={closeLabel}
              tabIndex={open ? 0 : -1}
              className="-me-2 rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-sunken p-4">
            {guide.imagePath ? (
              <ResponsiveImage
                path={guide.imagePath}
                alt={guide.title}
                width={1200}
                height={900}
                sizes="(min-width: 640px) 42rem, 100vw"
                className="mx-auto h-auto w-full object-contain"
              />
            ) : (
              <p className="px-2 py-10 text-center text-sm leading-relaxed text-ink-muted">
                <SiteStyledText contentKey="sizeGuide.missing">{missing}</SiteStyledText>
              </p>
            )}
          </div>

          <div className="shrink-0 border-t border-line p-4">
            <Link
              href={SIZE_GUIDE_HREF}
              className="btn btn-secondary w-full"
              tabIndex={open ? 0 : -1}
            >
              <SiteStyledText contentKey="sizeGuide.full">{full}</SiteStyledText>
              <span aria-hidden="true" className="mirror-rtl">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
