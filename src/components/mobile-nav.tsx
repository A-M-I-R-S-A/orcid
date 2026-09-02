'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Mobile navigation drawer.
 *
 * ── Why this is portalled ──────────────────────────────────────────────────
 * The trigger lives inside <header>, which carries `backdrop-blur`. Per spec,
 * an element with a `backdrop-filter` becomes the CONTAINING BLOCK for its
 * `position: fixed` descendants — so a drawer rendered in place resolved
 * `inset-0` against the header's 375×132 box instead of the viewport. It came
 * out clipped to header height and shoved off-screen.
 *
 * Portalling to <body> is the fix, not a larger z-index: the problem was the
 * containing block, not stacking order. The drawer must not have a
 * backdrop-filtered ancestor.
 *
 * It slides from the INLINE START edge — the right in RTL — expressed with
 * logical properties so it follows direction rather than being hardcoded.
 */
export function MobileNav({
  categories,
  isSignedIn,
}: {
  categories: { name: string; slug: string }[]
  isSignedIn: boolean
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Portals need a DOM target, which does not exist during SSR.
  useEffect(() => setMounted(true), [])

  const close = useCallback(() => setOpen(false), [])

  // Close on navigation — otherwise the drawer stays open over the new page.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    // Lock the page behind the drawer. On iOS an unlocked body scrolls the
    // wrong layer entirely when the drawer is dragged.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the panel, and return it to the trigger on close — a
    // dialog that leaves focus behind it strands keyboard and screen-reader
    // users on the page underneath.
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }

      if (event.key !== 'Tab') return

      // Trap Tab inside the panel while it is modal.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables || focusables.length === 0) return

      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      ;(previouslyFocused ?? triggerRef.current)?.focus?.()
    }
  }, [open])

  const drawer = (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!open}
    >
      {/*
        The backdrop dismisses on tap but is NOT an accessible control: the
        header already has a "بستن منو" button, and a second control with the
        same name means a screen-reader user hears it twice with no way to
        tell them apart.
      */}
      <div className="absolute inset-0 bg-ink/50" onClick={close} aria-hidden="true" />

      <div
        ref={panelRef}
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="منوی اصلی"
        tabIndex={-1}
        className={`absolute inset-y-0 start-0 flex w-[86%] max-w-sm flex-col bg-bg shadow-2xl outline-none transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open ? 'translate-x-0' : 'rtl:translate-x-full ltr:-translate-x-full'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line p-5">
          <span className="text-lg">منو</span>
          <button
            type="button"
            onClick={close}
            className="-me-2 rounded-full p-2 transition-colors hover:bg-surface-sunken"
            aria-label="بستن منو"
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

        <nav className="flex-1 overflow-y-auto p-3" aria-label="ناوبری موبایل">
          <p className="eyebrow px-4 pb-2 pt-3">دسته‌بندی‌ها</p>
          <ul className="space-y-0.5">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/category/${encodeURIComponent(category.slug)}`}
                  className="flex items-center justify-between rounded-xl px-4 py-3.5 transition-colors hover:bg-surface-sunken"
                >
                  <span>{category.name}</span>
                  <span aria-hidden="true" className="mirror-rtl text-ink-subtle">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="eyebrow px-4 pb-2 pt-6">بیشتر</p>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/blog"
                className="block rounded-xl px-4 py-3.5 transition-colors hover:bg-surface-sunken"
              >
                مجله
              </Link>
            </li>
            <li>
              <Link
                href={isSignedIn ? '/account' : '/login'}
                className="block rounded-xl px-4 py-3.5 transition-colors hover:bg-surface-sunken"
              >
                {isSignedIn ? 'حساب کاربری' : 'ورود / ثبت‌نام'}
              </Link>
            </li>
            <li>
              <Link
                href="/p/contact"
                className="block rounded-xl px-4 py-3.5 transition-colors hover:bg-surface-sunken"
              >
                تماس با ما
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="-ms-2.5 rounded-full p-2.5 transition-colors hover:bg-surface-sunken"
        aria-label="باز کردن منو"
        aria-expanded={open}
        aria-controls="mobile-drawer"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {mounted ? createPortal(drawer, document.body) : null}
    </>
  )
}
