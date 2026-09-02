import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { blogPosts, homepageSections } from '@/db/schema'
import { ProductRail } from '@/components/product-card'
import { ImagePlaceholder, ResponsiveImage } from '@/components/media'
import { Divider, OrchidSpray } from '@/components/ornament'
import { SectionHeading, SectionLink, SectionTitleBlock } from '@/components/ui'
import { listCategories, listProducts } from '@/modules/catalog/queries'
import { CACHE_TAGS, cached } from '@/lib/cache'
import { getNamespace } from '@/lib/settings'
import { buildMetadata } from '@/lib/seo'
import { formatJalali } from '@/lib/jalali'

/**
 * Homepage. §11 / §54.
 *
 * Sections, their order and their visibility come from the `homepage_sections`
 * table, so an administrator rearranges the page without a deploy. The section
 * TYPES are a fixed catalogue rather than a free-form page builder — §54 warns
 * against the latter, and a fixed set is what lets each type be designed
 * properly instead of generically.
 *
 * ── Why the product sections are rails ────────────────────────────────────
 * They were grids. A grid section is hostage to its item count: four columns
 * holding three products leaves a column-wide hole, and this catalogue
 * produces that shape constantly. A rail is the same shape at any count, and
 * on a phone it turns a 2×4 wall of thumbnails into one row you flick.
 *
 * Rendered dynamically with cached DATA rather than statically prerendered.
 * This is the most-hit page on the site, so the queries must be cached (§73) —
 * but prerendering it would force `next build` to reach the database, which
 * the off-host build cannot do. See lib/cache.ts.
 */
export const dynamic = 'force-dynamic'

const loadSections = cached(
  async () =>
    db
      .select()
      .from(homepageSections)
      .where(eq(homepageSections.isVisible, true))
      .orderBy(asc(homepageSections.sortOrder)),
  ['homepage-sections'],
  { revalidate: 300, tags: [CACHE_TAGS.homepage] },
)

export async function generateMetadata() {
  const seo = await getNamespace('seo')
  const site = await getNamespace('site')

  return buildMetadata({
    title: seo.defaultTitle || `${site.siteName || 'ارکید'} — فروشگاه لباس زیر زنانه`,
    description: seo.defaultDescription,
    path: '/',
  })
}

export default async function HomePage() {
  const sections = await loadSections()

  return (
    <>
      {sections.map((section) => (
        <HomeSection key={section.id} section={section} />
      ))}
    </>
  )
}

type Section = typeof homepageSections.$inferSelect

async function HomeSection({ section }: { section: Section }) {
  const config = (section.config ?? {}) as { limit?: number; categoryId?: number }
  const limit = config.limit ?? 12

  switch (section.kind) {
    case 'hero':
      return <Hero section={section} />

    case 'categories':
      return <Categories section={section} />

    case 'featured_products': {
      const { items } = await listProducts({ featuredOnly: true, limit })
      if (items.length === 0) return null
      return (
        <Shelf>
          <ProductRail
            products={items}
            label="محصولات منتخب"
            heading={
              <SectionTitleBlock
                eyebrow="منتخب ارکید"
                title={section.title || 'محصولات منتخب'}
                subtitle={section.subtitle}
              />
            }
            aside={<SectionLink href="/category" label="مشاهده همه" />}
          />
        </Shelf>
      )
    }

    case 'new_arrivals': {
      const { items } = await listProducts({ newOnly: true, limit, sort: 'newest' })
      if (items.length === 0) return null
      return (
        <Shelf>
          <ProductRail
            products={items}
            label="جدیدترین‌ها"
            heading={
              <SectionTitleBlock
                eyebrow="تازه رسیده"
                title={section.title || 'جدیدترین‌ها'}
                subtitle={section.subtitle}
              />
            }
          />
        </Shelf>
      )
    }

    case 'bestsellers': {
      const { items } = await listProducts({ bestsellerOnly: true, limit, sort: 'popular' })
      if (items.length === 0) return null
      return (
        <Shelf tone="raised">
          <ProductRail
            products={items}
            label="پرفروش‌ترین‌ها"
            heading={
              <SectionTitleBlock
                eyebrow="پرفروش‌ترین‌ها"
                title={section.title || 'انتخاب مشتریان'}
                subtitle={section.subtitle}
              />
            }
          />
        </Shelf>
      )
    }

    case 'promo_banner':
      return <PromoBanner section={section} />

    case 'brand_story':
      return <BrandStory section={section} />

    case 'blog_teaser':
      return <BlogTeaser section={section} limit={config.limit ?? 3} />

    default:
      return null
  }
}

/**
 * A product shelf's outer frame.
 *
 * `raised` swaps the ground to the surface tone and adds hairlines top and
 * bottom, which is how consecutive shelves stay distinguishable without
 * needing a second dark band. One dark band per page is the whole point of it.
 */
function Shelf({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'raised' }) {
  return (
    <section
      className={
        tone === 'raised'
          ? 'border-y border-line bg-surface py-14 md:py-20'
          : 'py-14 md:py-20'
      }
    >
      <div className="container-page">{children}</div>
    </section>
  )
}

/* ── Section implementations ────────────────────────────────────────────── */

/**
 * Hero.
 *
 * Two layouts, because a hero with a photograph and a hero without one are
 * different design problems. With an image it is a full-bleed split — copy on
 * a paper ground, the photograph running to the viewport edge, one hairline
 * between them. Without, it becomes a tinted band with the botanical mark
 * bleeding off the end edge and the type set to the inline start.
 *
 * Neither is a rounded rectangle floating on the page background, which is
 * what it was: a card in a hero slot reads as a widget rather than a front
 * door, and it is the single loudest template tell on a shop homepage.
 */
function Hero({ section }: { section: Section }) {
  const hasImage = Boolean(section.imagePath)

  if (hasImage) {
    return (
      <section className="border-b border-line bg-surface">
        <div className="grid lg:grid-cols-2">
          <div className="order-2 flex items-center lg:order-1">
            <div className="container-page py-14 md:py-20 lg:py-28 lg:max-w-[720px]">
              <HeroCopy section={section} />
            </div>
          </div>
          <div className="order-1 min-h-[340px] border-b border-line lg:order-2 lg:min-h-[620px] lg:border-b-0 lg:border-s">
            <ResponsiveImage
              path={section.imagePath}
              alt={section.title || 'مجموعه ارکید'}
              width={1200}
              height={1400}
              sizes="(min-width: 1024px) 50vw, 100vw"
              // The hero is the LCP element. §72: never lazy-load the thing
              // the metric is measuring.
              priority
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden border-b border-line bg-bg-secondary">
      <OrchidSpray
        seed={1}
        className="pointer-events-none absolute -bottom-24 -end-24 h-[26rem] w-[26rem] text-accent/[0.10] sm:h-[34rem] sm:w-[34rem]"
      />
      <OrchidSpray
        seed={2}
        className="pointer-events-none absolute -start-24 -top-28 hidden h-80 w-80 rotate-180 text-accent/[0.07] lg:block"
      />

      <div className="container-page relative py-20 md:py-28 lg:py-36">
        <div className="max-w-2xl">
          <HeroCopy section={section} />
        </div>
      </div>
    </section>
  )
}

function HeroCopy({ section }: { section: Section }) {
  return (
    <>
      <p className="eyebrow animate-rise">مجموعه ارکید</p>

      <h1 className="display-title mt-6 animate-rise text-ink [animation-delay:80ms]">
        {section.title || 'ظرافت، در هر جزئیات'}
      </h1>

      {section.subtitle && (
        <p className="mt-6 max-w-lg animate-rise text-base leading-loose text-ink-muted [animation-delay:160ms] md:text-lg">
          {section.subtitle}
        </p>
      )}

      {section.linkUrl && (
        <div className="mt-10 animate-rise [animation-delay:240ms]">
          <Link href={section.linkUrl} className="btn btn-primary group/cta py-2 pe-2 ps-6">
            <span className="ps-1">{section.linkLabel || 'مشاهده مجموعه'}</span>
            {/*
              The arrow lives in its own disc flush with the button's inner
              padding, and drifts on hover. A naked glyph beside the label is
              the default that makes a CTA look untouched.
            */}
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/cta:-translate-x-1"
            >
              <span className="mirror-rtl">→</span>
            </span>
          </Link>
        </div>
      )}
    </>
  )
}

/**
 * Category strip.
 *
 * The column count is derived from the number of categories rather than fixed
 * at three, so the row always comes out full. The old layout gave the first
 * tile a 2-column span and a 2.2:1 crop while its neighbours were 3:4 — at
 * laptop widths that left a hole beside it and a second hole in the next row,
 * and read as a broken grid rather than an asymmetric one.
 *
 * Below `md` it is a scrolling strip: on a phone, five tiles in a 2-column
 * grid is a wall, and the last row is a lone tile with a gap next to it.
 */
async function Categories({ section }: { section: Section }) {
  const categories = (await listCategories()).filter((c) => c.parentId === null).slice(0, 6)
  if (categories.length === 0) return null

  return (
    <section className="container-page py-14 md:py-20">
      <SectionHeading
        eyebrow="دسته‌بندی‌ها"
        title={section.title || 'خرید بر اساس دسته'}
        subtitle={section.subtitle}
      />

      <div
        className="rail rail-bleed md:mx-0 md:grid md:gap-5 md:overflow-visible md:px-0"
        style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}
      >
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/category/${encodeURIComponent(category.slug)}`}
            className="group/cat w-[52vw] sm:w-[34vw] md:w-auto"
          >
            <div className="frame aspect-[4/5]">
              {category.imagePath ? (
                <ResponsiveImage
                  path={category.imagePath}
                  alt={category.name}
                  width={600}
                  height={750}
                  sizes="(min-width: 768px) 20vw, 52vw"
                  className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/cat:scale-[1.05]"
                />
              ) : (
                <ImagePlaceholder
                  width={600}
                  height={750}
                  seed={category.id}
                  className="h-full w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/cat:scale-[1.05]"
                />
              )}
            </div>

            {/*
              The label sits under the plate, in ink. It used to be white type
              on a scrim over the image — which disappeared entirely on the
              pale botanical placeholder every category currently uses. No
              chevron: the tile is plainly a link, and an arrow pushed to the
              far edge of a 280px tile just leaves a hole between two things
              that belong together.
            */}
            <h3 className="mt-3 font-[family-name:var(--font-body)] text-[15px] font-medium text-ink transition-colors duration-300 group-hover/cat:text-accent-2">
              {category.name}
            </h3>
          </Link>
        ))}
      </div>
    </section>
  )
}

/**
 * Promo banner — the page's one dark band.
 *
 * Full-bleed and square-cornered rather than an inset rounded panel: a cream
 * page carrying cream sections needs one hard anchor, and a maroon block that
 * runs edge to edge is it. Two of these would cancel each other out, which is
 * why nothing else on the page uses the band.
 */
function PromoBanner({ section }: { section: Section }) {
  return (
    <section className="band">
      <div className="grid items-stretch md:grid-cols-5">
        <div className="flex items-center md:col-span-3">
          <div className="container-page py-16 md:py-24 md:pe-4">
            <div className="max-w-xl">
              {section.title && (
                <h2 className="text-3xl leading-snug md:text-[2.75rem]">{section.title}</h2>
              )}
              {section.subtitle && (
                <p className="mt-5 max-w-lg leading-loose opacity-85">{section.subtitle}</p>
              )}
              {section.linkUrl && (
                <Link
                  href={section.linkUrl}
                  className="btn mt-9 border-current bg-transparent text-on-accent hover:bg-on-accent hover:text-accent"
                >
                  {section.linkLabel || 'مشاهده'}
                </Link>
              )}
            </div>
          </div>
        </div>

        {section.imagePath && (
          <div className="min-h-[240px] md:col-span-2">
            <ResponsiveImage
              path={section.imagePath}
              alt={section.title || ''}
              width={800}
              height={800}
              sizes="(min-width: 768px) 40vw, 100vw"
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
    </section>
  )
}

function BrandStory({ section }: { section: Section }) {
  return (
    <section className="container-page py-16 md:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <Divider className="mx-auto mb-12 max-w-xs" />
        <p className="eyebrow mb-6 justify-center">{section.linkLabel || 'درباره ارکید'}</p>
        {section.title && (
          <h2 className="text-3xl leading-snug text-ink md:text-[2.75rem]">{section.title}</h2>
        )}
        {section.subtitle && (
          <p className="mt-7 text-lg leading-loose text-ink-muted">{section.subtitle}</p>
        )}
        {section.linkUrl && (
          <Link href={section.linkUrl} className="btn btn-secondary mt-10">
            بیشتر بخوانید
          </Link>
        )}
      </div>
    </section>
  )
}

async function BlogTeaser({ section, limit }: { section: Section; limit: number }) {
  const posts = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      excerpt: blogPosts.excerpt,
      coverImagePath: blogPosts.coverImagePath,
      coverImageAlt: blogPosts.coverImageAlt,
      publishedAt: blogPosts.publishedAt,
    })
    .from(blogPosts)
    .where(eq(blogPosts.isPublished, true))
    .orderBy(blogPosts.publishedAt)
    .limit(limit)

  if (posts.length === 0) return null

  return (
    <section className="container-page py-14 md:py-20">
      <SectionHeading
        eyebrow="مجله ارکید"
        title={section.title || 'خواندنی‌ها'}
        subtitle={section.subtitle}
        action={{ label: 'همه نوشته‌ها', href: '/blog' }}
      />

      <div className="rail rail-bleed md:mx-0 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:px-0">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${encodeURIComponent(post.slug)}`}
            className="group w-[78vw] sm:w-[52vw] md:w-auto"
          >
            <div className="frame aspect-[3/2]">
              <ResponsiveImage
                path={post.coverImagePath}
                alt={post.coverImageAlt ?? post.title}
                width={800}
                height={534}
                sizes="(min-width: 768px) 33vw, 78vw"
                className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
              />
            </div>

            {post.publishedAt && (
              <time
                dateTime={post.publishedAt.toISOString()}
                className="nums mt-4 block text-xs text-ink-subtle"
              >
                {formatJalali(post.publishedAt)}
              </time>
            )}

            <h3 className="mt-2 text-lg leading-snug text-ink transition-colors group-hover:text-accent-2">
              {post.title}
            </h3>

            {post.excerpt && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                {post.excerpt}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
