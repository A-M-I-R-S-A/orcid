import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/logout-button'
import { getCurrentUser } from '@/lib/session'
import { maskPhone } from '@/lib/persian'

/**
 * Customer account. §36 / §70.
 *
 * Every page under here is noindex and dynamic — it is personal data, and
 * caching or indexing any of it would be a leak rather than an optimisation.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  robots: { index: false, follow: false },
}

const NAV = [
  { href: '/account', label: 'پیشخوان' },
  { href: '/account/orders', label: 'سفارش‌های من' },
  { href: '/account/reviews', label: 'دیدگاه‌های من' },
]

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/account')

  return (
    <div className="container-page py-10 md:py-16">
      <div className="grid lg:grid-cols-4 gap-8 lg:gap-12 items-start">
        <aside className="lg:sticky lg:top-28">
          <div className="card p-5 mb-4">
            <p className="text-sm text-ink-muted">حساب کاربری</p>
            <p className="font-medium text-ink mt-1">{user.fullName || 'کاربر ارکید'}</p>
            <p className="text-sm text-ink-subtle nums mt-0.5">{maskPhone(user.phone)}</p>
          </div>

          <nav aria-label="ناوبری حساب کاربری" className="card p-2">
            <ul>
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block px-4 py-3 rounded-lg hover:bg-surface-sunken transition-colors text-[15px]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="border-t border-line mt-2 pt-2">
                <LogoutButton />
              </li>
            </ul>
          </nav>
        </aside>

        <div className="lg:col-span-3">{children}</div>
      </div>
    </div>
  )
}
