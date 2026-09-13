'use client'

import { SiteStyledText } from '@/components/site-content-provider'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { ImagePlaceholder, ResponsiveImage } from './media'
import { toPersianDigits } from '@/lib/persian'
import { SIZE_GUIDE_HREF, SIZE_GUIDE_LABEL } from '@/lib/size-guide'
import { safePublicHref } from '@/lib/public-url'
import { useSiteText } from '@/components/site-content-provider'

export interface DrawerCategory {
  name: string
  slug: string
  imagePath: string | null
}

export function MobileNav({
  categories,
  isSignedIn,
  fullName,
  cartCount,
  social,
  moreLinks = [],
}: {
  categories: DrawerCategory[]
  isSignedIn: boolean
  fullName?: string | null
  cartCount: number
  social: {
    instagram?: string | null
    telegram?: string | null
    whatsapp?: string | null
  }
  moreLinks?: { label: string; href: string }[]
}) {
  const t = useSiteText
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setMounted(true), [])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const previouslyFocused = document.activeElement as HTMLElement | null
    const trigger = triggerRef.current
    panelRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }

      if (event.key !== 'Tab') return

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
      ;(previouslyFocused ?? trigger)?.focus?.()
    }
  }, [open])

  const socialLinks = [
    { key: 'instagram' as const, label: t('footer.instagram', 'اینستاگرام'), url: safePublicHref(social.instagram) },
    { key: 'telegram' as const, label: t('footer.telegram', 'تلگرام'), url: safePublicHref(social.telegram) },
    { key: 'whatsapp' as const, label: t('footer.whatsapp', 'واتس‌اپ'), url: safePublicHref(social.whatsapp) },
  ].filter((s) => Boolean(s.url))

  const drawer = (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-ink/50" onClick={close} aria-hidden="true" />

      <div
        ref={panelRef}
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('mobile.menu', 'منوی اصلی')}
        tabIndex={-1}
        className={`absolute inset-y-0 start-0 flex w-[88%] max-w-sm flex-col bg-bg shadow-2xl outline-none transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open ? 'translate-x-0' : 'rtl:translate-x-full ltr:-translate-x-full'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <img
            src="/logo.png"
            alt={t('mobile.logoAlt', 'ارکید')}
            width={110}
            height={35}
            className="h-8 w-auto object-contain object-center"
          />
          <button
            type="button"
            onClick={close}
            className="-me-2 rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            aria-label={t('mobile.closeMenu', 'بستن منو')}
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

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4">
            {isSignedIn ? (
              <Link
                href="/account"
                className="flex items-center gap-3.5 rounded-md bg-surface p-4 transition-colors hover:bg-surface-sunken"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-lg text-on-accent"
                >
                  {(fullName ?? 'ا').trim().charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">
                    {fullName || t('header.account', 'حساب کاربری')}
                  </span>
                  <span className="block text-sm text-ink-subtle"><SiteStyledText contentKey="mobile.accountDescription">{t('mobile.accountDescription', 'مشاهده حساب و سفارش‌ها')}</SiteStyledText></span>
                </span>
                <span aria-hidden="true" className="mirror-rtl text-ink-subtle">
                  →
                </span>
              </Link>
            ) : (
              <div className="rounded-md bg-surface p-4">
                <p className="font-medium text-ink"><SiteStyledText contentKey="mobile.welcome">{t('mobile.welcome', 'به ارکید خوش آمدید')}</SiteStyledText></p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  <SiteStyledText contentKey="mobile.welcomeDescription">{t('mobile.welcomeDescription', 'برای ثبت سفارش و ذخیره علاقه‌مندی‌ها وارد شوید.')}</SiteStyledText>
                </p>
                <div className="mt-4 flex gap-2">
                  <Link href="/login" className="btn btn-primary btn-sm flex-1">
                    <SiteStyledText contentKey="mobile.login">{t('mobile.login', 'ورود')}</SiteStyledText>
                  </Link>
                  <Link href="/register" className="btn btn-secondary btn-sm flex-1">
                    <SiteStyledText contentKey="mobile.register">{t('mobile.register', 'ثبت‌نام')}</SiteStyledText>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 px-4 pb-5">
            <QuickLink
              href="/cart"
              label={t('header.cart', 'سبد خرید')}
              badge={cartCount}
              icon="M5 7h14l-1.2 12.1a2 2 0 01-2 1.9H8.2a2 2 0 01-2-1.9L5 7zm4 0V5.5a3 3 0 016 0V7"
            />
            <QuickLink
              href={isSignedIn ? '/account/wishlist' : '/login?next=/account/wishlist'}
              label={t('account.nav.wishlist', 'علاقه‌مندی')}
              icon="M12 20s-7-4.4-7-9.2A4 4 0 0112 8.6 4 4 0 0119 10.8C19 15.6 12 20 12 20z"
            />
            <QuickLink
              href={isSignedIn ? '/account/orders' : '/login?next=/account/orders'}
              label={t('mobile.orders', 'سفارش‌ها')}
              icon="M7 3h7l5 5v13H7V3zm7 0v5h5M10 13h6M10 17h6"
            />
          </div>

          <div className="border-t border-line px-4 pb-2 pt-5">
            <p className="eyebrow mb-3"><SiteStyledText contentKey="mobile.categories">{t('mobile.categories', 'دسته‌بندی‌ها')}</SiteStyledText></p>
            <ul className="space-y-1">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/category/${encodeURIComponent(category.slug)}`}
                    className="group/row flex items-center gap-3.5 rounded-md p-2 transition-colors hover:bg-surface-sunken"
                  >
                    <span className="frame h-12 w-12 shrink-0">
                      {category.imagePath ? (
                        <ResponsiveImage
                          path={category.imagePath}
                          alt=""
                          width={96}
                          height={96}
                          sizes="48px"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImagePlaceholder width={96} height={96} seed={category.slug.length} className="h-full w-full" />
                      )}
                    </span>
                    <span className="flex-1 text-[15px] text-ink">{category.name}</span>
                    <span
                      aria-hidden="true"
                      className="mirror-rtl text-ink-subtle transition-transform duration-300 group-hover/row:-translate-x-0.5"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-4 pb-6 pt-4">
            <p className="eyebrow mb-3"><SiteStyledText contentKey="mobile.more">{t('mobile.more', 'بیشتر')}</SiteStyledText></p>
            <ul className="space-y-0.5">
              {moreLinks.length > 0 ? (
                moreLinks.map((link) => (
                  <TextLink key={link.href} href={link.href}>
                    {link.label}
                  </TextLink>
                ))
              ) : (
                <>
                  <TextLink href={SIZE_GUIDE_HREF}>{SIZE_GUIDE_LABEL}</TextLink>
                  <TextLink href="/blog"><SiteStyledText contentKey="blog.title">{t('blog.title', 'مجله ارکید')}</SiteStyledText></TextLink>
                  <TextLink href="/p/about"><SiteStyledText contentKey="about.eyebrow">{t('about.eyebrow', 'درباره ما')}</SiteStyledText></TextLink>
                  <TextLink href="/p/shipping"><SiteStyledText contentKey="mobile.shipping">{t('mobile.shipping', 'شیوه ارسال')}</SiteStyledText></TextLink>
                  <TextLink href="/p/contact"><SiteStyledText contentKey="common.contactUs">{t('common.contactUs', 'تماس با ما')}</SiteStyledText></TextLink>
                </>
              )}
            </ul>
          </div>
        </div>

        {socialLinks.length > 0 && (
          <div className="shrink-0 border-t border-line px-5 py-4">
            <ul className="flex gap-2.5">
              {socialLinks.map((link) => (
                <li key={link.key}>
                  <a
                    href={link.url!}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-label={link.label}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:border-accent-2 hover:text-accent-2"
                  >
                    <SocialGlyph name={link.key} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
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
        aria-label={t('mobile.openMenu', 'باز کردن منو')}
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

function QuickLink({
  href,
  label,
  icon,
  badge,
}: {
  href: string
  label: string
  icon: string
  badge?: number
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-col items-center gap-2 rounded-md border border-line bg-surface px-2 py-3.5 text-center transition-colors hover:border-accent-3"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-accent"
      >
        <path d={icon} />
      </svg>
      <span className="text-xs text-ink">{label}</span>
      {badge != null && badge > 0 && (
        <span className="nums absolute end-2 top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-on-accent">
          {toPersianDigits(badge)}
        </span>
      )}
    </Link>
  )
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-md px-2 py-3 text-[15px] text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
      >
        {children}
      </Link>
    </li>
  )
}

function SocialGlyph({ name }: { name: 'instagram' | 'telegram' | 'whatsapp' }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (name === 'instagram') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (name === 'telegram') {
    return (
      <svg {...common}>
        <path d="M21 4.5L2.8 11.3c-.7.3-.7 1.2 0 1.4l4.6 1.5 1.7 5c.2.6 1 .8 1.4.3l2.5-2.6 4.5 3.3c.6.4 1.3.1 1.5-.6L21.9 5.6c.2-.8-.5-1.4-1.2-1.1z" />
        <path d="M7.4 14.2L18.6 6.9l-8.1 8.4-.4 4" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M3.5 20.5l1.3-4.4A8 8 0 1112 20a8 8 0 01-4-1.1l-4.5 1.6z" />
      <path d="M9 9c0 3 2.4 5.4 5.3 5.6.6 0 1.2-.4 1.3-1l.1-.7-2-.9-.8.9c-1-.4-1.8-1.2-2.2-2.2l.9-.8-.9-2-.7.1c-.6.1-1 .6-1 1.2z" />
    </svg>
  )
}
