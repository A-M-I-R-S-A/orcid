'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LogoutButton } from '@/components/logout-button'
import { toPersianDigits } from '@/lib/persian'

interface NavItem {
  href: string
  label: string
  icon: string
  count?: number
  exact?: boolean
}

export function AccountNav({
  counts,
  getLaterEnabled = false,
}: {
  counts: { orders: number; wishlist: number; addresses: number; getLater: number }
  getLaterEnabled?: boolean
}) {
  const pathname = usePathname()

  const items: NavItem[] = [
    {
      href: '/account',
      label: 'پیشخوان',
      exact: true,
      icon: 'M4 13h7V4H4v9zm9 7h7v-9h-7v9zM4 20h7v-5H4v5zm9-11h7V4h-7v5z',
    },
    {
      href: '/account/orders',
      label: 'سفارش‌ها',
      count: counts.orders,
      icon: 'M5 7h14l-1.1 12a2 2 0 01-2 1.8H8.1a2 2 0 01-2-1.8L5 7zm4 0V5.5a3 3 0 016 0V7',
    },
    ...(getLaterEnabled || counts.getLater > 0
      ? [{
          href: '/account/get-later',
          label: 'پرداخت بعدی',
          count: counts.getLater,
          icon: 'M4 7h16v11H4V7zm3-3v6m10-6v6M7 14h4m5-2v4m-2-2h4',
        }]
      : []),
    {
      href: '/account/wishlist',
      label: 'علاقه‌مندی‌ها',
      count: counts.wishlist,
      icon: 'M12 20s-7-4.4-7-9.2A4 4 0 0112 8.6 4 4 0 0119 10.8C19 15.6 12 20 12 20z',
    },
    {
      href: '/account/addresses',
      label: 'نشانی‌ها',
      count: counts.addresses,
      icon: 'M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11zm0-8.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z',
    },
    {
      href: '/account/reviews',
      label: 'دیدگاه‌ها',
      icon: 'M21 12a8 8 0 01-11.6 7.1L4 21l1.9-5.4A8 8 0 1121 12z',
    },
    {
      href: '/account/profile',
      label: 'اطلاعات حساب',
      icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-3.6 3.6-6 8-6s8 2.4 8 6',
    },
  ]

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <nav aria-label="ناوبری حساب کاربری">
      <ul className="rail rail-bleed border-y border-line py-2 lg:hidden">
        {items.map((item) => {
          const active = isActive(item)
          return (
            <li key={item.href} className="!flex-none">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
                  active ? 'bg-accent text-on-accent' : 'text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                <Icon path={item.icon} />
                {item.label}
                {item.count != null && item.count > 0 && (
                  <span className="nums text-xs opacity-70">{toPersianDigits(item.count)}</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      <ul className="hidden lg:block">
        {items.map((item) => {
          const active = isActive(item)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`group/nav relative flex items-center gap-3 rounded-md px-3.5 py-3 text-[15px] transition-colors ${
                  active
                    ? 'bg-surface-sunken font-medium text-ink'
                    : 'text-ink-muted hover:bg-surface-sunken/60 hover:text-ink'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-2 -inset-inline-start-px w-[2px] rounded-full bg-accent transition-opacity ${
                    active ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ insetInlineStart: 0 }}
                />
                <Icon path={item.icon} />
                <span className="flex-1">{item.label}</span>
                {item.count != null && item.count > 0 && (
                  <span className="nums text-xs text-ink-subtle">
                    {toPersianDigits(item.count)}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
        <li className="mt-2 border-t border-line pt-2">
          <LogoutButton />
        </li>
      </ul>
    </nav>
  )
}

function Icon({ path }: { path: string }) {
  return (
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
      className="shrink-0"
    >
      <path d={path} />
    </svg>
  )
}
