import Link from 'next/link'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import { pages } from '@/db/schema'
import { CACHE_TAGS, cached } from '@/lib/cache'
import { toPersianDigits } from '@/lib/persian'
import { sanitizeEnamad, sanitizeHtml } from '@/lib/sanitize'
import { getNamespace } from '@/lib/settings'
import { splitLead } from '@/lib/rich-text'
import { OrchidSpray } from '@/components/ornament'
import { Icon, type IconName } from './icons'
import { ClosingBand, Movement, PageHero } from './shell'

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

const SHORTCUT_META: Record<string, { icon: IconName; hint: string }> = {
  faq: { icon: 'question', hint: 'پاسخ پرسش‌های پرتکرار درباره سفارش، سایز و ارسال.' },
  shipping: { icon: 'truck', hint: 'زمان آماده‌سازی، هزینه ارسال و نحوه بسته‌بندی.' },
  returns: { icon: 'refresh', hint: 'شرایط تعویض و بازگشت کالا را پیش از خرید بخوانید.' },
  'size-guide': { icon: 'ruler', hint: 'جدول سایز و روش اندازه‌گیری صحیح.' },
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
}: {
  page: PageRow
  breadcrumbs: { name: string; path: string }[]
}) {
  const [contact, social, enamad, shortcuts] = await Promise.all([
    getNamespace('contact'),
    getNamespace('social'),
    getNamespace('enamad'),
    loadShortcuts(),
  ])

  const body = page.body ? sanitizeHtml(page.body) : ''
  const { lead, rest } = splitLead(body)

  const channels: Channel[] = []

  if (contact.phone) {
    channels.push({
      key: 'phone',
      icon: 'phone',
      label: 'تماس تلفنی',
      value: contact.phone,
      display: toPersianDigits(contact.phone),
      href: `tel:${contact.phone}`,
      action: 'شماره‌گیری',
      ltr: true,
    })
  }

  if (social.whatsapp) {
    channels.push({
      key: 'whatsapp',
      icon: 'whatsapp',
      label: 'واتس‌اپ',
      value: social.whatsapp,
      display: 'گفت‌وگوی مستقیم',
      href: social.whatsapp,
      action: 'شروع گفت‌وگو',
      external: true,
    })
  }

  if (social.telegram) {
    channels.push({
      key: 'telegram',
      icon: 'telegram',
      label: 'تلگرام',
      value: social.telegram,
      display: 'پیام در تلگرام',
      href: social.telegram,
      action: 'ارسال پیام',
      external: true,
    })
  }

  if (contact.email) {
    channels.push({
      key: 'email',
      icon: 'mail',
      label: 'ایمیل',
      value: contact.email,
      display: contact.email,
      href: `mailto:${contact.email}`,
      action: 'نوشتن ایمیل',
      ltr: true,
    })
  }

  if (social.instagram) {
    channels.push({
      key: 'instagram',
      icon: 'instagram',
      label: 'اینستاگرام',
      value: social.instagram,
      display: 'جدیدترین‌ها را ببینید',
      href: social.instagram,
      action: 'دنبال کنید',
      external: true,
    })
  }

  const hasPlace = Boolean(contact.address || contact.workingHours)

  const heroAside =
    contact.phone || contact.workingHours ? (
      <div className="rounded-[var(--radius-card)] border border-line-strong/70 bg-surface-raised/40 p-7 backdrop-blur-sm">
        {contact.phone && (
          <>
            <p className="text-sm text-ink-subtle">پاسخگوی شما</p>
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
    <>
      <PageHero
        eyebrow="پشتیبانی و مشاوره"
        title={page.title}
        lead={lead || 'هر پرسشی درباره سایز، سفارش یا ارسال دارید، از نزدیک‌ترین راه زیر بپرسید.'}
        imagePath={page.imagePath}
        breadcrumbs={breadcrumbs}
        aside={heroAside}
      />

      {channels.length > 0 && (
        <Movement>
          <div className="masthead">
            <div className="max-w-xl">
              <p className="eyebrow">راه‌های ارتباطی</p>
              <h2 className="section-title mt-6">از هر کدام راحت‌ترید</h2>
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
                    <h2 className="mt-6 text-2xl text-ink">نشانی</h2>
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
                    <h2 className="mt-6 text-2xl text-ink">ساعات پاسخگویی</h2>
                    <p className="mt-4 max-w-sm leading-loose text-ink-muted">
                      {contact.workingHours}
                    </p>
                    <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-subtle">
                      پیام‌های خارج از این ساعت را در نخستین فرصت کاری پاسخ می‌دهیم.
                    </p>
                  </div>
                )}
              </div>

              {enamad.embedCode && (
                <div className="relative mt-12 border-t border-line pt-9">
                  <p className="eyebrow">نماد اعتماد الکترونیکی</p>
                  <div
                    className="mt-5 inline-block rounded-lg bg-white p-2 [&_img]:h-auto [&_img]:max-w-[110px]"
                    dangerouslySetInnerHTML={{ __html: sanitizeEnamad(enamad.embedCode) }}
                  />
                </div>
              )}
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
            <p className="eyebrow">شاید پاسخ اینجا باشد</p>
            <h2 className="section-title mt-6">پیش از تماس، یک نگاه</h2>
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
                    <p className="mt-2 text-sm leading-loose text-ink-muted">{meta.hint}</p>
                  )}
                </Link>
              )
            })}
          </div>
        </Movement>
      )}

      <ClosingBand
        eyebrow="سفارش شما"
        title="سفارشی در جریان دارید؟"
        body="وضعیت لحظه‌ای سفارش‌ها، کد رهگیری و فاکتورها در حساب کاربری شما در دسترس است."
        links={[
          { label: 'پیگیری سفارش', href: '/account/orders', primary: true },
          { label: 'مشاهده محصولات', href: '/products' },
        ]}
      />
    </>
  )
}
