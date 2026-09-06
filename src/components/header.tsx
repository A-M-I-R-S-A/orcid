import Link from 'next/link'

import { listCategories } from '@/modules/catalog/queries'
import { cartCount } from '@/modules/cart/service'
import { getCurrentUser } from '@/lib/session'
import { getNamespace } from '@/lib/settings'
import { toPersianDigits } from '@/lib/persian'
import { CategoryNav } from './category-nav'
import { MobileNav } from './mobile-nav'
import { SearchField } from './search-field'

export async function Header() {
  const [categories, site, social, user] = await Promise.all([
    listCategories(),
    getNamespace('site'),
    getNamespace('social'),
    getCurrentUser(),
  ])

  const count = await cartCount(user?.id ?? null)
  const siteName = site.siteName || 'ارکید'
  const topLevel = categories.filter((c) => c.parentId === null).slice(0, 6)

  return (
    <header
      id="site-header"
      className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-sm"
    >
      {site.announcementText ? (
        <div className="band px-4 py-2 text-center text-sm">{site.announcementText}</div>
      ) : null}

      <div className="container-page">
        <div className="header-bar flex h-[68px] items-center justify-between gap-4">
          <div className="lg:hidden">
            <MobileNav
              categories={topLevel.map((c) => ({
                name: c.name,
                slug: c.slug,
                imagePath: c.imagePath ?? null,
              }))}
              isSignedIn={Boolean(user)}
              fullName={user?.fullName ?? null}
              cartCount={count}
              social={{
                instagram: social.instagram,
                telegram: social.telegram,
                whatsapp: social.whatsapp,
              }}
            />
          </div>

          <Link href="/" className="shrink-0" aria-label={`${siteName} — صفحه اصلی`}>
            <img
              src={site.logoPath ? `/api/media/${site.logoPath}` : '/logo.png'}
              alt={siteName}
              width={138}
              height={44}
              loading="eager"
              fetchPriority="high"
              className="header-logo h-9 w-auto object-contain object-center"
            />
          </Link>

          <div className="hidden flex-1 justify-center md:flex">
            <div className="w-full max-w-sm">
              <SearchField />
            </div>
          </div>

          <div className="flex items-center gap-1 md:border-s md:border-line md:ps-2">
            <IconLink
              href={user ? '/account' : '/login'}
              label={user ? 'حساب کاربری' : 'ورود به حساب'}
            >
              <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
              <path d="M4 21c0-3.6 3.6-6 8-6s8 2.4 8 6" />
            </IconLink>

            <IconLink
              href={user ? '/account/wishlist' : '/login?next=/account/wishlist'}
              label="علاقه‌مندی‌ها"
              className="hidden sm:inline-flex"
            >
              <path d="M12 20s-7-4.4-7-9.2A4 4 0 0112 8.6 4 4 0 0119 10.8C19 15.6 12 20 12 20z" />
            </IconLink>

            <Link
              href="/cart"
              className="relative rounded-full p-2.5 transition-colors hover:bg-surface-sunken"
              aria-label={count > 0 ? `سبد خرید، ${count} کالا` : 'سبد خرید'}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 7h14l-1.2 12.1a2 2 0 01-2 1.9H8.2a2 2 0 01-2-1.9L5 7z" />
                <path d="M9 7V5.5a3 3 0 016 0V7" />
              </svg>
              {count > 0 && (
                <span
                  className="nums absolute -top-0.5 -end-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-medium text-on-accent"
                  aria-hidden="true"
                >
                  {toPersianDigits(count)}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      <CategoryNav
        categories={topLevel.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
      />

      <div className="container-page pb-3 md:hidden">
        <SearchField />
      </div>
    </header>
  )
}

function IconLink({
  href,
  label,
  children,
  className,
}: {
  href: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`rounded-full p-2.5 transition-colors hover:bg-surface-sunken ${className ?? ''}`}
      aria-label={label}
    >
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </Link>
  )
}
