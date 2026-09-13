import { SiteStyledText } from '@/components/site-content-provider'
import { and, eq, ne, sql } from 'drizzle-orm'

import { db } from '@/db'
import { categories, pages, products, reviews } from '@/db/schema'
import { CACHE_TAGS, cached } from '@/lib/cache'
import { toPersianDigits } from '@/lib/persian'
import { sanitizeHtml } from '@/lib/sanitize'
import { getNamespace } from '@/lib/settings'
import { getSiteContent } from '@/lib/site-content'
import { splitLead } from '@/lib/rich-text'
import { Divider, OrchidBloom } from '@/components/ornament'
import { Icon, type IconName } from './icons'
import { ClosingBand, Movement, PageHero, RelatedPages } from './shell'

type PageRow = typeof pages.$inferSelect

const loadStats = cached(
  async () => {
    const [productRows, categoryRows, reviewRows] = await Promise.all([
      db
        .select({ value: sql<number>`count(*)` })
        .from(products)
        .where(and(eq(products.isActive, true), eq(products.isArchived, false))),
      db
        .select({ value: sql<number>`count(*)` })
        .from(categories)
        .where(eq(categories.isVisible, true)),
      db
        .select({
          value: sql<number>`count(*)`,
          average: sql<string>`coalesce(avg(${reviews.rating}), 0)`,
        })
        .from(reviews)
        .where(eq(reviews.status, 'approved')),
    ])

    return {
      products: Number(productRows[0]?.value ?? 0),
      categories: Number(categoryRows[0]?.value ?? 0),
      reviews: Number(reviewRows[0]?.value ?? 0),
      rating: Number(reviewRows[0]?.average ?? 0),
    }
  },
  ['about-stats'],
  { revalidate: 900, tags: [CACHE_TAGS.products, CACHE_TAGS.categories] },
)

const loadSiblings = cached(
  async (slug: string) =>
    db
      .select({ slug: pages.slug, title: pages.title })
      .from(pages)
      .where(and(eq(pages.isPublished, true), eq(pages.showInFooter, true), ne(pages.slug, slug)))
      .orderBy(pages.sortOrder)
      .limit(4),
  ['about-siblings'],
  { revalidate: 3600, tags: [CACHE_TAGS.pages] },
)

export async function AboutPage({
  page,
  breadcrumbs,
}: {
  page: PageRow
  breadcrumbs: { name: string; path: string }[]
}) {
  const [site, shipping, stats, siblings, content] = await Promise.all([
    getNamespace('site'),
    getNamespace('shipping'),
    loadStats(),
    loadSiblings(page.slug),
    getSiteContent(),
  ])

  const siteName = site.siteName || 'ارکید'
  const pillars: { icon: IconName; title: string; body: string }[] = [
    { icon: 'sparkle', title: content.text('about.pillar.fabricTitle'), body: content.text('about.pillar.fabricBody') },
    { icon: 'ruler', title: content.text('about.pillar.sizeTitle'), body: content.text('about.pillar.sizeBody') },
    { icon: 'package', title: content.text('about.pillar.packageTitle'), body: content.text('about.pillar.packageBody') },
    { icon: 'heart', title: content.text('about.pillar.supportTitle'), body: content.text('about.pillar.supportBody') },
  ]
  const body = page.body ? sanitizeHtml(page.body) : ''
  const { lead, rest } = splitLead(body)

  const figures = [
    { label: content.text('about.activeProducts'), value: stats.products },
    { label: content.text('about.categories'), value: stats.categories },
    { label: content.text('about.reviews'), value: stats.reviews },
  ].filter((figure) => figure.value > 0)

  const promises = [
    { key: 'shippingInfo', title: content.text('about.shipping'), value: shipping.shippingInfo },
    { key: 'returnPolicy', title: content.text('about.returns'), value: shipping.returnPolicy },
  ].filter((promise) => Boolean(promise.value))

  return (
    <>
      <PageHero
        eyebrow={content.text('about.eyebrow')}
        title={page.title}
        lead={lead || site.tagline || undefined}
        imagePath={page.imagePath}
        breadcrumbs={breadcrumbs}
        links={[
          { label: content.text('common.viewProducts'), href: '/products', primary: true },
          { label: content.text('common.contactUs'), href: '/p/contact' },
        ]}
      />

      {figures.length > 0 && (
        <section className="border-b border-line bg-surface">
          <div className="container-page">
            <dl className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
              {figures.map((figure, index) => (
                <div
                  key={figure.label}
                  className={`py-9 text-center sm:py-11 ${index > 0 ? 'sm:border-s sm:border-line' : ''}`}
                >
                  <dd className="nums font-[family-name:var(--font-heading)] text-4xl text-accent-2 md:text-5xl">
                    {toPersianDigits(figure.value)}
                  </dd>
                  <dt className="mt-3 text-sm text-ink-muted">{figure.label}</dt>
                </div>
              ))}

              {stats.rating > 0 && (
                <div className="border-t border-line py-9 text-center sm:border-s sm:border-t-0 sm:py-11">
                  <dd className="nums font-[family-name:var(--font-heading)] text-4xl text-accent-2 md:text-5xl">
                    {toPersianDigits(stats.rating.toFixed(1))}
                  </dd>
                  <dt className="mt-3 text-sm text-ink-muted"><SiteStyledText contentKey="about.averageRating">{content.text('about.averageRating')}</SiteStyledText></dt>
                </div>
              )}
            </dl>
          </div>
        </section>
      )}

      {rest && (
        <section className="movement-open container-page">
          <div className="grid gap-12 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-4">
              <div className="md:sticky md:top-32">
                <span aria-hidden="true" className="mb-8 block h-px w-14 bg-accent-2" />
                <h2 className="font-[family-name:var(--font-heading)] text-3xl leading-tight text-ink md:text-[2.6rem]">
                  <SiteStyledText contentKey="about.storyTitle">{content.text('about.storyTitle')}</SiteStyledText>
                </h2>
                <OrchidBloom className="mt-8 hidden h-10 w-10 text-accent-3 md:block" />
              </div>
            </div>

            <div className="md:col-span-7 md:col-start-6">
              <div
                className="prose max-w-none text-[1.05rem] text-ink-muted"
                dangerouslySetInnerHTML={{ __html: rest }}
              />
            </div>
          </div>
        </section>
      )}

      <Movement tone="sunken">
        <div className="max-w-2xl">
          <p className="eyebrow"><SiteStyledText contentKey="about.promiseEyebrow">{content.text('about.promiseEyebrow')}</SiteStyledText></p>
          <h2 className="section-title mt-6"><SiteStyledText contentKey="about.promiseTitle">{content.text('about.promiseTitle')}</SiteStyledText></h2>
        </div>

        <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {pillars.map((pillar, index) => (
            <div key={pillar.title}>
              <div className="flex items-center gap-4">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-accent-2">
                  <Icon name={pillar.icon} className="h-5 w-5" />
                </span>
                <span className="nums text-xs text-ink-subtle">
                  {toPersianDigits(String(index + 1).padStart(2, '0'))}
                </span>
              </div>

              <h3 className="mt-6 text-xl text-ink">{pillar.title}</h3>
              <p className="mt-3 text-[15px] leading-loose text-ink-muted">{pillar.body}</p>
            </div>
          ))}
        </div>
      </Movement>

      {promises.length > 0 && (
        <Movement>
          <Divider className="mx-auto max-w-md" />

          <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-14">
            {promises.map((promise) => (
              <article key={promise.key} className="card px-7 py-9 md:px-9 md:py-11">
                <h3 className="text-xl text-ink">{promise.title}</h3>
                <p className="mt-4 whitespace-pre-line leading-loose text-ink-muted">
                  {promise.value}
                </p>
              </article>
            ))}
          </div>
        </Movement>
      )}

      <RelatedPages pages={siblings} heading={content.text('about.learnMore')} />

      <ClosingBand
        eyebrow={content.text('about.start')}
        title={`مجموعه ${siteName} را ببینید`}
        body={content.text('about.closingBody')}
        links={[
          { label: content.text('common.viewProducts'), href: '/products', primary: true },
          { label: content.text('about.faq'), href: '/p/faq' },
        ]}
      />
    </>
  )
}
