'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { adminLogoutAction } from '@/modules/admin/actions'
import type { Permission } from '@/lib/permissions'
import { toPersianDigits } from '@/lib/persian'

interface NavItem {
  href: string
  label: string
  permission: Permission | null
  badge?: 'payments' | 'reviews' | 'sms'
  icon: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    title: 'عملیات',
    items: [
      { href: '/admin', label: 'پیشخوان', permission: null, icon: 'M4 13h7V4H4v9zm9 7h7v-9h-7v9zM4 20h7v-5H4v5zm9-11h7V4h-7v5z' },
      {
        href: '/admin/orders',
        label: 'سفارش‌ها',
        permission: 'orders.view',
        icon: 'M5 7h14l-1.1 12a2 2 0 01-2 1.8H8.1a2 2 0 01-2-1.8L5 7zm4 0V5.5a3 3 0 016 0V7',
      },
      {
        href: '/admin/payments',
        label: 'پرداخت‌ها',
        permission: 'payments.view',
        badge: 'payments',
        icon: 'M3 8h18M3 8a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm4 7h4',
      },
      {
        href: '/admin/customers',
        label: 'مشتریان',
        permission: 'customers.view',
        icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-3.6 3.6-6 8-6s8 2.4 8 6',
      },
      {
        href: '/admin/get-later',
        label: 'پرداخت بعدی',
        permission: 'orders.update_status',
        icon: 'M4 7h16v11H4V7zm3-3v6m10-6v6M7 14h4m5-2v4m-2-2h4',
      },
    ],
  },
  {
    title: 'فروشگاه',
    items: [
      {
        href: '/admin/products',
        label: 'محصولات',
        permission: 'products.view',
        icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 0v18m8-13.5L12 12 4 7.5',
      },
      {
        href: '/admin/categories',
        label: 'دسته‌بندی‌ها',
        permission: 'categories.view',
        icon: 'M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z',
      },
      {
        href: '/admin/reviews',
        label: 'دیدگاه‌ها',
        permission: 'reviews.view',
        badge: 'reviews',
        icon: 'M21 12a8 8 0 01-11.6 7.1L4 21l1.9-5.4A8 8 0 1121 12z',
      },
    ],
  },
  {
    title: 'محتوا',
    items: [
      {
        href: '/admin/homepage',
        label: 'صفحه اصلی',
        permission: 'content.homepage',
        icon: 'M4 11l8-7 8 7v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8z',
      },
      {
        href: '/admin/pages',
        label: 'صفحات',
        permission: 'content.pages',
        icon: 'M7 3h7l5 5v13H7V3zm7 0v5h5M10 13h6M10 17h6',
      },
      {
        href: '/admin/navigation',
        label: 'منو و فوتر',
        permission: 'content.navigation',
        icon: 'M4 6h16M4 12h16M4 18h10',
      },
      {
        href: '/admin/blog',
        label: 'وبلاگ',
        permission: 'blog.view',
        icon: 'M5 4h14v16l-7-3.5L5 20V4zM9 8h6',
      },
    ],
  },
  {
    title: 'پیکربندی',
    items: [
      {
        href: '/admin/sms',
        label: 'پیامک',
        permission: 'sms.view',
        badge: 'sms',
        icon: 'M4 5h16v11H9l-5 4V5zM8 10h8',
      },
      {
        href: '/admin/appearance',
        label: 'ظاهر سایت',
        permission: 'appearance.theme',
        icon: 'M12 3a9 9 0 000 18c1.1 0 2-.9 2-2 0-.5-.2-1-.6-1.4-.3-.4-.4-.8-.4-1.1 0-.8.7-1.5 1.5-1.5H17a4 4 0 004-4c0-4.4-4-8-9-8zM7.5 12a1 1 0 100-2 1 1 0 000 2zm3-3.5a1 1 0 100-2 1 1 0 000 2zm5 0a1 1 0 100-2 1 1 0 000 2z',
      },
      {
        href: '/admin/content',
        label: 'متن و ظاهر',
        permission: 'appearance.brand',
        icon: 'M4 5h16v14H4V5zm4 4h8M8 13h5',
      },
      {
        href: '/admin/settings',
        label: 'تنظیمات',
        permission: 'settings.view',
        icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 00-2-1.2L14.5 2h-4l-.4 2.6c-.7.3-1.4.7-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
      },
      {
        href: '/admin/admins',
        label: 'مدیران',
        permission: 'admins.view',
        icon: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm-6 9c0-3.1 2.7-5 6-5s6 1.9 6 5m1-14.6a3.5 3.5 0 010 6.7m2.5 2.4c2 .6 3.5 2.1 3.5 4.5',
      },
      {
        href: '/admin/audit',
        label: 'گزارش فعالیت',
        permission: 'audit.view',
        icon: 'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
      },
    ],
  },
]

export function AdminShell({
  admin,
  badges,
  children,
}: {
  admin: { fullName: string; username: string; roleKey: string; permissions: Permission[] }
  badges: { payments: number; reviews: number; sms: number }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  const navRef = useRef<HTMLElement | null>(null)
  const [edges, setEdges] = useState({ top: false, bottom: false })

  const measureEdges = useCallback(() => {
    const el = navRef.current
    if (!el) return

    const top = Math.abs(el.scrollTop)
    const room = el.scrollHeight - el.clientHeight
    const next = { top: top > 4, bottom: room - top > 4 }

    setEdges((previous) =>
      previous.top === next.top && previous.bottom === next.bottom ? previous : next,
    )
  }, [])

  useEffect(() => {
    const el = navRef.current
    if (!el) return

    measureEdges()
    el.addEventListener('scroll', measureEdges, { passive: true })

    const observer = new ResizeObserver(measureEdges)
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', measureEdges)
      observer.disconnect()
    }
  }, [measureEdges])

  const granted = new Set(admin.permissions)
  const isSuper = admin.roleKey === 'superadmin'
  const allowed = (permission: Permission | null) =>
    permission === null || isSuper || granted.has(permission)

  const visibleGroups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowed(item.permission)),
  })).filter((group) => group.items.length > 0)

  const current = visibleGroups
    .flatMap((group) => group.items)
    .find((item) =>
      item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href),
    )

  const logout = async () => {
    setPending(true)
    try {
      await adminLogoutAction()
      router.push('/admin/login')
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] bg-bg">
      <aside
        data-open={menuOpen}
        className="admin-drawer fixed inset-y-0 start-0 z-40 flex h-[100dvh] w-[17rem] flex-col border-e border-line bg-surface lg:sticky lg:top-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <Link href="/admin" className="block">
            <img
              src="/logo.png"
              alt="ارکید"
              width={119}
              height={38}
              className="h-9 w-auto object-contain object-center"
            />
            <p className="mt-1.5 text-xs text-ink-subtle">پنل مدیریت</p>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="-me-2 rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-sunken lg:hidden"
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

        <nav
          ref={navRef}
          data-edge-top={edges.top}
          data-edge-bottom={edges.bottom}
          className="scroll-edges flex-1 overflow-y-auto p-3"
          aria-label="ناوبری مدیریت"
        >
          {visibleGroups.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="px-3 pb-2 text-[11px] font-semibold text-ink-subtle">{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item === current
                  const count = item.badge ? badges[item.badge] : 0

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          active
                            ? 'bg-accent font-medium text-on-accent'
                            : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
                        }`}
                      >
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="shrink-0 opacity-90"
                        >
                          <path d={item.icon} />
                        </svg>

                        <span className="flex-1 truncate">{item.label}</span>

                        {count > 0 && (
                          <span
                            className={`nums flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] ${
                              active ? 'bg-white/25' : 'bg-warning-bg text-warning'
                            }`}
                          >
                            {toPersianDigits(count)}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-ink">{admin.fullName}</p>
            <p className="truncate text-xs text-ink-subtle" dir="ltr">
              {admin.username}
            </p>
          </div>
          <Link
            href="/"
            target="_blank"
            rel="noopener"
            className="block rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            مشاهده فروشگاه ↗
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={pending}
            className="w-full rounded-lg px-3 py-2 text-start text-sm text-ink-muted transition-colors hover:bg-danger-bg hover:text-danger disabled:opacity-50"
          >
            {pending ? 'در حال خروج…' : 'خروج'}
          </button>
        </div>
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="-ms-2 rounded-lg p-2 hover:bg-surface-sunken"
            aria-label="باز کردن منو"
            aria-expanded={menuOpen}
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
          <span className="text-sm text-ink">{current?.label ?? 'پنل مدیریت ارکید'}</span>
        </div>

        <main className="w-full max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
