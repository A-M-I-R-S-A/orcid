import { redirect } from 'next/navigation'

import { AccountNav } from '@/components/account/nav'
import { getCurrentUser } from '@/lib/session'
import { maskPhone } from '@/lib/persian'
import { addressCount, wishlistCount } from '@/modules/account/service'
import { countForUser } from '@/modules/orders/queries'

export const dynamic = 'force-dynamic'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/account')

  const [orders, wishlist, addresses] = await Promise.all([
    countForUser(user.id),
    wishlistCount(user.id),
    addressCount(user.id),
  ])

  return (
    <div className="container-page py-8 md:py-14">
      <div className="grid items-start gap-8 lg:grid-cols-4 lg:gap-12">
        <aside className="min-w-0 lg:sticky lg:top-32">
          <div className="mb-4 flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-lg text-on-accent"
            >
              {(user.fullName ?? 'ا').trim().charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{user.fullName || 'کاربر ارکید'}</p>
              <p className="nums truncate text-sm text-ink-subtle" dir="ltr">
                {maskPhone(user.phone)}
              </p>
            </div>
          </div>

          <AccountNav counts={{ orders, wishlist, addresses }} />
        </aside>

        <div className="min-w-0 lg:col-span-3">{children}</div>
      </div>
    </div>
  )
}
