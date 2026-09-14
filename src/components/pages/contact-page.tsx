import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import { pages } from '@/db/schema'
import { CACHE_TAGS, cached } from '@/lib/cache'
import { toPersianDigits } from '@/lib/persian'
import { sanitizeHtml } from '@/lib/sanitize'
import { getNamespace } from '@/lib/settings'
import { getSiteContent, type CopyKey } from '@/lib/site-content'
import { splitLead } from '@/lib/rich-text'
import { safePublicHref } from '@/lib/public-url'
import { OrchidSpray } from '@/components/ornament'
import { Icon, type IconName } from './icons'
import { ClosingBand, Movement, PageHero } from './shell'
import { ManagedTemplateSections } from './managed-page-section'
import type { PageSectionRecord } from '@/lib/page-sections'
import { SYSTEM_PAGE_SECTIONS } from '@/lib/system-page-sections'

type PageRow = typeof pages.$inferSelect

interface Channel {
  key: string
  icon: IconName
  label: string
  value: string
  display: string
  href: string
  action: string
  external?: boolean
  ltr?: boolean
}

const SHORTCUT_SLUGS = ['faq', 'shipping', 'returns', 'size-guide'] as const

const SHORTCUT_META: Record<string, { icon: IconName; hintKey: CopyKey }> = {
  faq: { icon: 'question', hintKey: 'contact.shortcutFaq' },
  shipping: { icon: 'truck', hintKey: 'contact.shortcutShipping' },
  returns: { icon: 'refresh', hintKey: 'contact.shortcutReturns' },
  'size-guide': { icon: 'ruler', hintKey: 'contact.shortcutSize' },
}

const loadShortcuts = cached(
  async () =>
    db
      .select({ slug: pages.slug, title: pages.title })
      .from(pages)
      .where(
        and(eq(pages.isPublished, true), inArray(pages.slug, [...SHORTCUT_SLUGS])),
      )
      .orderBy(pages.sortOrder),
  ['contact-shortcuts'],
  { revalidate: 3600, tags: [CACHE_TAGS.pages] },
)

export async function ContactPage({
  page,
  breadcrumbs,
  sections,
}: {
  page: PageRow
  breadcrumbs: { name: string; path: string }[]
  sections: PageSectionRecord[]
}) {
  const [contact, social, shortcuts, content] = await Promise.all([
    getNamespace('contact'),
    getNamespace('social'),
    loadShortcuts(),
    getSiteContent(),
  ])

  const body = page.body ? sanitizeHtml(page.body) : ''
  const { lead, rest } = splitLead(body)

  const channels: Channel[] = []
  const whatsapp = safePublicHref(social.whatsapp)
  const telegram = safePublicHref(social.telegram)
  const instagram = safePublicHref(social.instagram)

  if (contact.phone) {
    channels.push({
      key: 'phone',
      icon: 'phone',
      label: content.text('contact.phone'),
      value: contact.phone,
      display: toPersianDigits(contact.phone),
      href: `tel:${contact.phone}`,
      action: content.text('contact.call'),
      ltr: true,
    })
  }

  if (whatsapp) {
    channels.push({
      key: 'whatsapp',
      icon: 'whatsapp',
      label: content.text('footer.whatsapp'),
      value: whatsapp,
      display: content.text('contact.whatsappDisplay'),
      href: whatsapp,
      action: content.text('contact.whatsappAction'),
      external: true,
    })
  }

  if (telegram) {
    channels.push({
      key: 'telegram',
      icon: 'telegram',
      label: content.text('footer.telegram'),
      value: telegram,
      display: content.text('contact.telegramDisplay'),
      href: telegram,
      action: content.text('contact.sendMessage'),
      external: true,
    })
  }

  if (contact.email) {
    channels.push({
      key: 'email',
      icon: 'mail',
      label: content.text('contact.email'),
      value: contact.email,
      display: contact.email,
      href: `mailto:${contact.email}`,
      action: content.text('contact.emailAction'),
      ltr: true,
    })
  }

  if (instagram) {
    channels.push({
      key: 'instagram',
      icon: 'instagram',
      label: content.text('footer.instagram'),
      value: instagram,
      display: content.text('contact.instagramDisplay'),
      href: instagram,
      action: content.text('contact.follow'),
      external: true,
    })
  }

  const hasPlace = Boolean(contact.address || contact.workingHours)

  const heroAside =
    contact.phone || contact.workingHours ? (
      <div className="rounded-[var(--radius-card)] border border-line-strong/70 bg-surface-raised/40 p-7 backdrop-blur-sm">
        {contact.phone && (
          <>
            <p className="text-sm text-ink-subtle"><SiteStyledText contentKey="contact.responder">{content.text('contact.responder')}</SiteStyledText></p>
            <a
              href={`tel:${contact.phone}`}
              dir="ltr"
              className="nums mt-3 block text-end font-[family-name:var(--font-heading)] text-3xl text-ink transition-colors hover:text-accent-2"
            >
              {toPersianDigits(contact.phone)}
            </a>
          </>
        )}

        {contact.workingHours && (
          <p className="mt-6 flex items-start gap-3 border-t border-line pt-6 text-sm leading-relaxed text-ink-muted">
            <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-accent-2" />
            {contact.workingHours}
          </p>
        )}
      </div>
    ) : null

  return (
    <ManagedTemplateSections pageId={page.id} sections={sections} defaults={SYSTEM_PAGE_SECTIONS.contact}>
      <PageHero
        eyebrow={content.text('contact.eyebrow')}
        title={content.text('contact.title')}
        lead={lead || content.text('contact.heroLead')}
        contentKeys={{ eyebrow: 'contact.eyebrow', title: 'contact.title', lead: 'contact.heroLead' }}
        imagePath={page.imagePath}
        breadcrumbs={breadcrumbs}
        aside={heroAside}
      />

      {channels.length > 0 && (
        <Movement>
          <div className="masthead">
            <div className="max-w-xl">
              <p className="eyebrow"><SiteStyledText contentKey="contact.channelsEyebrow">{content.text('contact.channelsEyebrow')}</SiteStyledText></p>
              <h2 className="section-title mt-6"><SiteStyledText contentKey="contact.channelsTitle">{content.text('contact.channelsTitle')}</SiteStyledText></h2>
            </div>
            <span aria-hidden="true" className="masthead-rule" />
          </div>

          <div className="mt-12 flex flex-wrap gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line">
            {channels.map((channel) => (
              <a
                key={channel.key}
                href={channel.href}
                {...(channel.external
                  ? { target: '_blank', rel: 'noopener noreferrer nofollow' }
                  : {})}
                className="group flex flex-1 basis-72 flex-col justify-between gap-8 bg-surface p-8 transition-colors hover:bg-surface-raised"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-line-strong text-accent-2 transition-colors group-hover:border-accent-2 group-hover:bg-accent-2 group-hover:text-on-accent">
                  <Icon name={channel.icon} className="h-5 w-5" />
                </span>

                <span className="block">
                  <span className="block text-sm text-ink-subtle">{channel.label}</span>
                  <span
                    dir={channel.ltr ? 'ltr' : undefined}
                    className={`mt-2 block break-all text-lg text-ink transition-colors group-hover:text-accent-2 ${
                      channel.ltr ? 'nums text-end' : ''
                    }`}
                  >
                    {channel.display}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm text-accent-2">
                    {channel.action}
                    <span
                      aria-hidden="true"
                      className="mirror-rtl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-x-1"
                    >
                      →
                    </span>
                  </span>
                </span>
              </a>
            ))}
          </div>
        </Movement>
      )}

      {hasPlace && (
        <section className="movement border-y border-line bg-surface-sunken/50">
          <div className="container-page">
            <div className="relative isolate overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface px-7 py-11 md:px-14 md:py-16">
              <OrchidSpray
                seed={2}
                className="pointer-events-none absolute -bottom-16 -end-10 h-72 w-72 text-accent/[0.06]"
              />

              <div className="relative grid gap-10 md:grid-cols-2 md:gap-16">
                {contact.address && (
                  <div>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-accent-2">
                      <Icon name="pin" className="h-5 w-5" />
                    </span>
                    <h2 className="mt-6 text-2xl text-ink"><SiteStyledText contentKey="contact.address">{content.text('contact.address')}</SiteStyledText></h2>
                    <p className="mt-4 max-w-sm whitespace-pre-line leading-loose text-ink-muted">
                      {contact.address}
                    </p>
                  </div>
                )}

                {contact.workingHours && (
                  <div>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-accent-2">
                      <Icon name="clock" className="h-5 w-5" />
                    </span>
                    <h2 className="mt-6 text-2xl text-ink"><SiteStyledText contentKey="contact.hours">{content.text('contact.hours')}</SiteStyledText></h2>
                    <p className="mt-4 max-w-sm leading-loose text-ink-muted">
                      {contact.workingHours}
                    </p>
                    <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-subtle">
                      <SiteStyledText contentKey="contact.afterHours">{content.text('contact.afterHours')}</SiteStyledText>
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>
      )}

      {rest && (
        <Movement>
          <div
            className="prose max-w-3xl text-[1.05rem] text-ink-muted"
            dangerouslySetInnerHTML={{ __html: rest }}
          />
        </Movement>
      )}

      {shortcuts.length > 0 && (
        <Movement tone="raised">
          <div className="max-w-xl">
            <p className="eyebrow"><SiteStyledText contentKey="contact.shortcutsEyebrow">{content.text('contact.shortcutsEyebrow')}</SiteStyledText></p>
            <h2 className="section-title mt-6"><SiteStyledText contentKey="contact.shortcutsTitle">{content.text('contact.shortcutsTitle')}</SiteStyledText></h2>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {shortcuts.map((shortcut) => {
              const meta = SHORTCUT_META[shortcut.slug]

              return (
                <Link
                  key={shortcut.slug}
                  href={`/p/${encodeURIComponent(shortcut.slug)}`}
                  className="group border-t border-line-strong pt-6"
                >
                  {meta && (
                    <Icon
                      name={meta.icon}
                      className="h-6 w-6 text-accent-2 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-1"
                    />
                  )}
                  <h3 className="mt-5 text-lg text-ink transition-colors group-hover:text-accent-2">
                    {shortcut.title}
                  </h3>
                  {meta && (
                    <p className="mt-2 text-sm leading-loose text-ink-muted">{content.text(meta.hintKey)}</p>
                  )}
                </Link>
              )
            })}
          </div>
        </Movement>
      )}

      <ClosingBand
        eyebrow={content.text('contact.yourOrder')}
        title={content.text('contact.orderTitle')}
        body={content.text('contact.orderBody')}
        links={[
          { label: content.text('contact.orderCta'), href: '/account/orders', primary: true },
          { label: content.text('common.viewProducts'), href: '/products' },
        ]}
      />
    </ManagedTemplateSections>
  )
}
