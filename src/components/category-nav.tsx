'use client'

import Link from 'next/link'

import { SIZE_GUIDE_HREF, SIZE_GUIDE_LABEL } from '@/lib/size-guide'
import { usePathname } from 'next/navigation'

import { OrchidBloom } from './ornament'

export interface NavCategory {
  id: number
  name: string
  slug: string
}

export function CategoryNav({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname()

  const current = safeDecode(pathname)

  return (
    <nav aria-label="ناوبری اصلی" className="header-nav hidden border-y border-line bg-surface lg:block">
      <div className="container-page">
        <ul className="flex items-stretch justify-center">
          {categories.map((category) => (
            <li key={category.id}>
              <NavItem
                href={`/category/${encodeURIComponent(category.slug)}`}
                active={current === `/category/${category.slug}`}
              >
                {category.name}
              </NavItem>
            </li>
          ))}

          <li className="flex items-center px-4" aria-hidden="true">
            <OrchidBloom className="h-3.5 w-3.5 text-accent-3" />
          </li>

          <li>
            <NavItem href={SIZE_GUIDE_HREF} active={current === SIZE_GUIDE_HREF}>
              {SIZE_GUIDE_LABEL}
            </NavItem>
          </li>

          <li>
            <NavItem href="/blog" active={current.startsWith('/blog')}>
              مجله
            </NavItem>
          </li>
        </ul>
      </div>
    </nav>
  )
}

function NavItem({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`group/nav relative flex h-[var(--nav-height,3.5rem)] items-center px-5 text-[15px] transition-[color,height] duration-300 ${
        active ? 'font-medium text-ink' : 'text-ink-muted hover:text-accent-2'
      }`}
    >
      {children}

      <span
        aria-hidden="true"
        className={`absolute inset-x-2 bottom-0 h-[2px] origin-[100%_50%] rounded-full bg-accent transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] ltr:origin-[0_50%] ${
          active ? 'scale-x-100' : 'scale-x-0 group-hover/nav:scale-x-100 group-hover/nav:bg-accent-3'
        }`}
      />
    </Link>
  )
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
