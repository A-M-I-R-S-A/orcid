import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import { pages } from '@/db/schema'
import { CACHE_TAGS, cached } from '@/lib/cache'
import { toPersianDigits } from '@/lib/persian'
import { sanitizeHtml } from '@/lib/sanitize'
import { getNamespace } from '@/lib/settings'
import { excerpt, parseFaq, toPlainText } from '@/lib/rich-text'
import { faqSchema } from '@/lib/seo'
import { getSiteContent } from '@/lib/site-content'
import { JsonLd } from '@/components/json-ld'
import { Icon } from './icons'
import { ClosingBand, Movement, PageHero } from './shell'
import { ManagedTemplateSections } from './managed-page-section'
import type { PageSectionRecord } from '@/lib/page-sections'
import { SYSTEM_PAGE_SECTIONS } from '@/lib/system-page-sections'

type PageRow = typeof pages.$inferSelect

const HELP_SLUGS = ['shipping', 'returns', 'size-guide', 'contact'] as const

const loadHelpPages = cached(
  async () =>
    db
      .select({ slug: pages.slug, title: pages.title })
      .from(pages)
      .where(and(eq(pages.isPublished, true), inArray(pages.slug, [...HELP_SLUGS])))
      .orderBy(pages.sortOrder),
  ['faq-help-pages'],
  { revalidate: 3600, tags: [CACHE_TAGS.pages] },
)

function groupId(index: number) {
  return `faq-group-${index + 1}`
}

export async function FaqPage({
  page,
  breadcrumbs,
  sections,
}: {
  page: PageRow
  breadcrumbs: { name: string; path: string }[]
  sections: PageSectionRecord[]
}) {
  const [contact, helpPages, content] = await Promise.all([getNamespace('contact'), loadHelpPages(), getSiteContent()])

  const body = page.body ? sanitizeHtml(page.body) : ''
  const { intro, groups } = parseFaq(body)

  const total = groups.reduce((sum, group) => sum + group.items.length, 0)
  const showIndex = groups.length > 1 && groups.every((group) => group.title)

  const schemaItems = groups
    .flatMap((group) => group.items)
    .map((item) => ({ question: item.question, answer: toPlainText(item.answer) }))
    .filter((item) => item.answer)

  let counter = 0

  return (
    <ManagedTemplateSections pageId={page.id} sections={sections} defaults={SYSTEM_PAGE_SECTIONS.faq}>
      <>
      {schemaItems.length > 0 && <JsonLd data={faqSchema(schemaItems)} />}

      <PageHero
        eyebrow={content.text('faq.eyebrow')}
        title={content.text('faq.title')}
        lead={
          intro
            ? excerpt(intro, 200)
            : content.text('faq.description')
        }
        contentKeys={{ eyebrow: 'faq.eyebrow', title: 'faq.title', lead: 'faq.description' }}
        breadcrumbs={breadcrumbs}
        aside={
          total > 0 ? (
            <div className="rounded-[var(--radius-card)] border border-line-strong/70 bg-surface-raised/40 p-7 backdrop-blur-sm">
              <p className="nums font-[family-name:var(--font-heading)] text-5xl text-ink">
                {toPersianDigits(total)}
              </p>
              <p className="mt-3 text-sm text-ink-muted"><SiteStyledText contentKey="faq.answered">{content.text('faq.answered')}</SiteStyledText></p>

              {contact.phone && (
                <p className="mt-6 flex items-start gap-3 border-t border-line pt-6 text-sm leading-relaxed text-ink-muted">
                  <Icon name="phone" className="mt-0.5 h-4 w-4 shrink-0 text-accent-2" />
                  <span>
                    <SiteStyledText contentKey="faq.notFound">{content.text('faq.notFound')}</SiteStyledText>{' '}
                    <a
                      href={`tel:${contact.phone}`}
                      dir="ltr"
                      className="nums text-accent-2 hover:underline"
                    >
                      {toPersianDigits(contact.phone)}
                    </a>{' '}
                    <SiteStyledText contentKey="faq.call">{content.text('faq.call')}</SiteStyledText>
                  </span>
                </p>
              )}
            </div>
          ) : null
        }
      />
      </>

      {groups.length === 0 ? (
        <Movement>
          {body ? (
            <div
              className="prose mx-auto text-[1.05rem] text-ink-muted"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <p className="mx-auto max-w-xl text-center leading-loose text-ink-muted">
              <SiteStyledText contentKey="faq.empty">{content.text('faq.empty')}</SiteStyledText>
            </p>
          )}
        </Movement>
      ) : (
        <Movement>
          <div className={showIndex ? 'grid gap-12 lg:grid-cols-12 lg:gap-16' : ''}>
            {showIndex && (
              <nav aria-label={content.text('faq.topicsAria')} className="lg:col-span-3">
                <div className="lg:sticky lg:top-32">
                  <p className="eyebrow"><SiteStyledText contentKey="faq.topics">{content.text('faq.topics')}</SiteStyledText></p>
                  <ul className="mt-6 space-y-1">
                    {groups.map((group, index) => (
                      <li key={groupId(index)}>
                        <a
                          href={`#${groupId(index)}`}
                          className="flex items-baseline justify-between gap-3 rounded-md px-3 py-2.5 text-[15px] text-ink-muted transition-colors hover:bg-surface-sunken hover:text-accent-2"
                        >
                          {group.title}
                          <span className="nums text-xs text-ink-subtle">
                            {toPersianDigits(group.items.length)}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </nav>
            )}

            <div className={showIndex ? 'lg:col-span-8 lg:col-start-5' : 'mx-auto max-w-3xl'}>
              {groups.map((group, groupIndex) => (
                <section
                  key={groupId(groupIndex)}
                  id={groupId(groupIndex)}
                  className={`scroll-mt-32 ${groupIndex > 0 ? 'mt-20' : ''}`}
                >
                  {group.title && (
                    <div className="mb-8">
                      <h2 className="font-[family-name:var(--font-heading)] text-2xl text-ink md:text-3xl">
                        {group.title}
                      </h2>
                      <span aria-hidden="true" className="mt-5 block h-px w-14 bg-accent-2" />
                    </div>
                  )}

                  {group.intro && (
                    <div
                      className="prose mb-8 max-w-none text-ink-muted"
                      dangerouslySetInnerHTML={{ __html: group.intro }}
                    />
                  )}

                  <div className="border-t border-line">
                    {group.items.map((item) => {
                      counter += 1

                      return (
                        <details
                          key={`${groupId(groupIndex)}-${counter}`}
                          open={counter === 1}
                          className="group border-b border-line"
                        >
                          <summary className="flex cursor-pointer list-none items-start gap-5 py-6 [&::-webkit-details-marker]:hidden">
                            <span className="nums mt-1 w-7 shrink-0 text-sm text-ink-subtle">
                              {toPersianDigits(String(counter).padStart(2, '0'))}
                            </span>

                            <h3 className="flex-1 text-lg leading-relaxed text-ink transition-colors group-hover:text-accent-2 group-open:text-accent-2">
                              {item.question}
                            </h3>

                            <span
                              aria-hidden="true"
                              className="relative mt-2.5 h-3.5 w-3.5 shrink-0 text-accent-2"
                            >
                              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
                              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-open:scale-y-0" />
                            </span>
                          </summary>

                          <div
                            className="prose max-w-none pb-8 ps-12 text-ink-muted"
                            dangerouslySetInnerHTML={{ __html: item.answer }}
                          />
                        </details>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </Movement>
      )}

      {helpPages.length > 0 && (
        <Movement tone="raised">
          <p className="eyebrow"><SiteStyledText contentKey="faq.related">{content.text('faq.related')}</SiteStyledText></p>

          <div className="mt-9 flex flex-wrap gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line">
            {helpPages.map((helpPage) => (
              <Link
                key={helpPage.slug}
                href={`/p/${encodeURIComponent(helpPage.slug)}`}
                className="group flex flex-1 basis-60 items-center justify-between gap-4 bg-surface px-6 py-7 transition-colors hover:bg-surface-raised"
              >
                <span className="text-[15px] leading-snug text-ink transition-colors group-hover:text-accent-2">
                  {helpPage.title}
                </span>
                <span
                  aria-hidden="true"
                  className="mirror-rtl shrink-0 text-accent-2 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-x-1"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </Movement>
      )}

      <ClosingBand
        eyebrow={content.text('faq.closingEyebrow')}
        title={content.text('faq.closingTitle')}
        body={content.text('faq.closingBody')}
        links={[
          { label: content.text('common.contactUs'), href: '/p/contact', primary: true },
          { label: content.text('footer.tracking'), href: '/account/orders' },
        ]}
      />
    </ManagedTemplateSections>
  )
}
