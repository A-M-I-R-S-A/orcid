import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { pages } from '@/db/schema'
import { listCategories } from '@/modules/catalog/queries'
import { navLinksFor } from '@/modules/content/queries'
import { getNamespace } from '@/lib/settings'
import { toPersianDigits } from '@/lib/persian'
import { jalaliYear } from '@/lib/jalali'
import { sanitizeEnamad } from '@/lib/sanitize'
import { safePublicHref } from '@/lib/public-url'
import { getSiteContent } from '@/lib/site-content'

export async function Footer() {
  const [categories, site, contact, social, enamad, footerPages, shopLinks, helpLinks, content] =
    await Promise.all([
      listCategories(),
      getNamespace('site'),
      getNamespace('contact'),
      getNamespace('social'),
      getNamespace('enamad'),
      db
        .select({ slug: pages.slug, title: pages.title })
        .from(pages)
        .where(eq(pages.showInFooter, true))
        .orderBy(pages.sortOrder),
      navLinksFor('footer_shop'),
      navLinksFor('footer_help'),
      getSiteContent(),
    ])

  const siteName = site.siteName || 'ارکید'
  const topLevel = categories.filter((c) => c.parentId === null).slice(0, 6)

  const shopColumn =
    shopLinks.length > 0
      ? shopLinks
      : topLevel.map((c) => ({
          label: c.name,
          href: `/category/${encodeURIComponent(c.slug)}`,
        }))

  const helpColumn =
    helpLinks.length > 0
      ? helpLinks
      : [
          ...footerPages.map((p) => ({
            label: p.title,
            href: `/p/${encodeURIComponent(p.slug)}`,
          })),
          { label: content.text('footer.tracking'), href: '/account/orders' },
        ]

  const shopHeading = site.footerShopHeading || 'فروشگاه'
  const helpHeading = site.footerHelpHeading || 'راهنما و پشتیبانی'
  const contactHeading = site.footerContactHeading || 'تماس با ما'

  const socialLinks = [
    { key: 'instagram' as const, label: content.text('footer.instagram'), url: safePublicHref(social.instagram) },
    { key: 'telegram' as const, label: content.text('footer.telegram'), url: safePublicHref(social.telegram) },
    { key: 'whatsapp' as const, label: content.text('footer.whatsapp'), url: safePublicHref(social.whatsapp) },
  ].filter((s) => Boolean(s.url))

  const hasContactColumn = Boolean(
    contact.phone || contact.email || contact.address || contact.workingHours || enamad.embedCode,
  )

  return (
    <footer className="on-dark mt-24 border-t border-line">
      <div className="container-page py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <img
              src={site.logoPath ? `/api/media/${site.logoPath}` : '/logo.png'}
              alt={siteName}
              width={138}
              height={44}
              loading="lazy"
              className="site-mark h-11 w-auto object-contain object-center mb-4"
            />
            {site.tagline && (
              <p className="text-sm text-ink-muted leading-relaxed max-w-xs">{site.tagline}</p>
            )}

            {socialLinks.length > 0 && (
              <ul className="mt-7 flex gap-2.5">
                {socialLinks.map((link) => (
                  <li key={link.key}>
                    <a
                      href={link.url!}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line transition-colors hover:border-accent-2 hover:text-accent-2"
                      aria-label={link.label}
                    >
                      <SocialIcon name={link.key} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <nav aria-labelledby="footer-shop">
            <h2 id="footer-shop" className="mb-4 font-[family-name:var(--font-body)] text-sm font-semibold text-ink">
              {shopHeading}
            </h2>
            <ul className="space-y-2.5 text-sm text-ink-muted">
              {shopColumn.map((link, index) => (
                <li key={`${link.href}-${index}`}>
                  <Link href={link.href} className="hover:text-accent-2 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-help">
            <h2 id="footer-help" className="mb-4 font-[family-name:var(--font-body)] text-sm font-semibold text-ink">
              {helpHeading}
            </h2>
            <ul className="space-y-2.5 text-sm text-ink-muted">
              {helpColumn.map((link, index) => (
                <li key={`${link.href}-${index}`}>
                  <Link href={link.href} className="hover:text-accent-2 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {hasContactColumn ? (
          <div>
            <h2 className="mb-4 font-[family-name:var(--font-body)] text-sm font-semibold text-ink">{contactHeading}</h2>
            <ul className="space-y-2.5 text-sm text-ink-muted">
              {contact.phone && (
                <li>
                  <a href={`tel:${contact.phone}`} className="hover:text-accent-2 nums" dir="ltr">
                    {toPersianDigits(contact.phone)}
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="hover:text-accent-2">
                    {contact.email}
                  </a>
                </li>
              )}
              {contact.address && <li className="leading-relaxed">{contact.address}</li>}
              {contact.workingHours && <li>{contact.workingHours}</li>}
            </ul>

            {enamad.embedCode ? (
              <span
                className="contents"
                dangerouslySetInnerHTML={{ __html: sanitizeEnamad(enamad.embedCode) }}
              />
            ) : null}
          </div>
          ) : null}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line pt-8 text-sm text-ink-subtle sm:flex-row">
          <p className="nums">
            © {toPersianDigits(jalaliYear())} {siteName}. <SiteStyledText contentKey="footer.rights">{content.text('footer.rights')}</SiteStyledText>
          </p>
          {site.footerNote && <p>{site.footerNote}</p>}
        </div>
      </div>
    </footer>
  )
}

function SocialIcon({ name }: { name: 'instagram' | 'telegram' | 'whatsapp' }) {
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
