'use client'

import { Fragment } from 'react'
import Link from 'next/link'

import { usePathname } from 'next/navigation'

import { OrchidBloom } from './ornament'

export interface NavEntry {
  label: string
  href: string
}

export function CategoryNav({
  items,
  ornamentAfter,
}: {
  items: NavEntry[]
  ornamentAfter: number
}) {
  const pathname = usePathname()

  const current = safeDecode(pathname)

  if (items.length === 0) return null

  const showOrnament = ornamentAfter > 0 && ornamentAfter < items.length

  return (
    <nav aria-label="ناوبری اصلی" className="header-nav hidden border-y border-line bg-surface lg:block">
      <div className="container-page">
        <ul className="flex items-stretch justify-center">
          {items.map((item, index) => (
            <Fragment key={`${item.href}-${index}`}>
              {showOrnament && index === ornamentAfter && (
                <li className="flex items-center px-4" aria-hidden="true">
                  <OrchidBloom className="h-3.5 w-3.5 text-accent-3" />
                </li>
              )}
              <li>
                <NavItem href={item.href} active={isActive(current, item.href)}>
                  {item.label}
                </NavItem>
              </li>
            </Fragment>
          ))}
        </ul>
      </div>
    </nav>
  )
}

function isActive(current: string, href: string): boolean {
  if (href === '/') return current === '/'
  if (href.startsWith('http')) return false
  return current === href || current === safeDecode(href) || current.startsWith(`${href}/`)
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
