import Link from 'next/link'

import { listCategories } from '@/modules/catalog/queries'
import { cartCount } from '@/modules/cart/service'
import { getCurrentUser } from '@/lib/session'
import { getNamespace } from '@/lib/settings'
import { toPersianDigits } from '@/lib/persian'
import { MobileNav } from './mobile-nav'
import { SearchField } from './search-field'

/**
 * Site header. §12.
 *
 * A server component — the only interactive parts (the mobile drawer and the
 * search field) are small client islands. Rendering the whole header on the
 * client would put the navigation and the cart count behind hydration for no
 * benefit.
 *
 * ── Why two rows on desktop ───────────────────────────────────────────────
 * One row had to carry the logo, six category links, a search field and two
 * icon buttons. At 1280–1440 — the widths most customers are actually on —
 * every one of those was squeezed to its minimum and the whole bar read as
 * cramped. Splitting identity and tools from navigation gives the categories
 * their own line at a comfortable size, which is what a shop's navigation is
 * for. Below `lg` it collapses back to a single row plus the drawer.
 */
export async function Header() {
  const [categories, site, user] = await Promise.all([
    listCategories(),
    getNamespace('site'),
    getCurrentUser(),
  ])

  const count = await cartCount(user?.id ?? null)
  const siteName = site.siteName || 'ارکید'
  const topLevel = categories.filter((c) => c.parentId === null).slice(0, 6)

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-sm">
      {site.announcementText ? (
        <div className="band px-4 py-2 text-center text-sm">{site.announcementText}</div>
      ) : null}

      <div className="container-page">
        <div className="flex h-[68px] items-center justify-between gap-4 md:h-[84px]">
          {/* Mobile menu — the drawer itself is the client island. */}
          <div className="lg:hidden">
            <MobileNav
              categories={topLevel.map((c) => ({ name: c.name, slug: c.slug }))}
              isSignedIn={Boolean(user)}
            />
          </div>

          <Link href="/" className="shrink-0" aria-label={`${siteName} — صفحه اصلی`}>
            {/* The logo is never mirrored in RTL. §J. */}
            <img
              src={site.logoPath ? `/api/media/${site.logoPath}` : '/logo.png'}
              alt={siteName}
              width={138}
              height={44}
              // The header mark is the first paint on every page — eager.
              loading="eager"
              fetchPriority="high"
              className="h-9 w-auto object-contain object-center md:h-11"
            />
          </Link>

          <div className="hidden flex-1 justify-center md:flex">
            <div className="w-full max-w-md">
              <SearchField />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <IconLink
              href={user ? '/account' : '/login'}
              label={user ? 'حساب کاربری' : 'ورود به حساب'}
            >
              <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
              <path d="M4 21c0-3.6 3.6-6 8-6s8 2.4 8 6" />
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

      {/* Category navigation gets its own line from lg up. */}
      <nav
        aria-label="ناوبری اصلی"
        className="hidden border-t border-line/70 lg:block"
      >
        <div className="container-page">
          <ul className="flex items-stretch gap-8">
            {topLevel.map((category) => (
              <li key={category.id}>
                <NavLink href={`/category/${encodeURIComponent(category.slug)}`}>
                  {category.name}
                </NavLink>
              </li>
            ))}
            <li>
              <NavLink href="/blog">مجله</NavLink>
            </li>
          </ul>
        </div>
      </nav>

      {/* Search moves below the bar on mobile, where the header row has no
          room for it and it is a primary action. */}
      <div className="container-page pb-3 md:hidden">
        <SearchField />
      </div>
    </header>
  )
}

/**
 * A nav link with a rule that draws in under it on hover. The rule is a
 * pseudo-free element rather than `border-bottom`, so it animates from the
 * inline start without shifting the text by a pixel.
 */
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group/nav relative flex h-12 items-center text-[15px] text-ink transition-colors duration-300 hover:text-accent-2"
    >
      {children}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[2px] origin-[100%_50%] scale-x-0 bg-accent-2 transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/nav:scale-x-100 ltr:origin-[0_50%]"
      />
    </Link>
  )
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="rounded-full p-2.5 transition-colors hover:bg-surface-sunken"
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
