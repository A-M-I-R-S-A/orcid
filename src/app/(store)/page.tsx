import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { blogPosts, homepageSections } from '@/db/schema'
import { ProductRail } from '@/components/product-card'
import { ImagePlaceholder, ResponsiveImage } from '@/components/media'
import { storedWidth } from '@/lib/media-url'
import { OrchidSpray } from '@/components/ornament'
import { SectionHeading } from '@/components/ui'
import { listCategories, listProducts } from '@/modules/catalog/queries'
import { CACHE_TAGS, cached } from '@/lib/cache'
import { getNamespace } from '@/lib/settings'
import { buildMetadata } from '@/lib/seo'
import { formatJalali } from '@/lib/jalali'
import {
  BANNER_ALIGN_CLASS,
  BANNER_HEIGHT_CLASS,
  BANNER_POSITION_CLASS,
  BANNER_VEIL_CLASS,
  type BannerSettings,
  bannerImageStyle,
  parseBannerSettings,
} from '@/lib/banner'

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
        <Shelf tone="dark">
          <ProductRail
            products={items}
            label="محصولات منتخب"
            title={section.title || 'محصولات منتخب'}
            subtitle={section.subtitle}
            action={{ label: 'مشاهده همه', href: '/products' }}
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
            title={section.title || 'جدیدترین‌ها'}
            subtitle={section.subtitle}
            action={{ label: 'همه محصولات', href: '/products?sort=newest' }}
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
            title={section.title || 'انتخاب مشتریان'}
            subtitle={section.subtitle}
            action={{ label: 'همه محصولات', href: '/products?sort=popular' }}
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

function Shelf({
  children,
  tone = 'plain',
}: {
  children: React.ReactNode
  tone?: 'plain' | 'raised' | 'dark'
}) {
  const ground =
    tone === 'dark'
      ? 'on-dark movement-open'
      : tone === 'raised'
        ? 'movement border-y border-line bg-surface'
        : 'movement'

  return (
    <section className={ground}>
      <div className="container-page">{children}</div>
    </section>
  )
}

interface BannerProps {
  section: Section
  design: BannerSettings
  heading: 'h1' | 'h2'
  priority?: boolean
  defaults: { title: string; href: string; label: string }
  canOverlayHeader?: boolean
}

function BannerFrame(props: BannerProps) {
  const { section, design, priority = false, canOverlayHeader = false } = props

  const overlay = canOverlayHeader && design.header === 'overlay' ? 'hero-overlay' : ''

  return (
    <section
      className={`relative isolate flex w-full flex-col overflow-hidden ${overlay} ${BANNER_VEIL_CLASS[design.veil]} ${BANNER_HEIGHT_CLASS[design.height]} ${BANNER_POSITION_CLASS[design.position]}`}
      data-banner-tone={design.tone}
      data-banner-position={design.position}
      style={{ '--scrim': `${design.overlay}%` } as React.CSSProperties}
    >
      <ResponsiveImage
        path={section.imagePath}
        alt={section.title || props.defaults.title}
        width={storedWidth(section.imagePath ?? '')}
        height={storedWidth(section.imagePath ?? '')}
        sizes="100vw"
        priority={priority}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        style={bannerImageStyle(design)}
      />

      <div aria-hidden="true" className="banner-scrim -z-10" />

      <div className="container-page relative flex w-full flex-col">
        <div className={`flex w-full flex-col ${BANNER_ALIGN_CLASS[design.align]}`}>
          <div className="max-w-2xl">
            <BannerCopy {...props} />
          </div>
        </div>
      </div>
    </section>
  )
}

function Hero({ section }: { section: Section }) {
  const design = parseBannerSettings(section.config)

  const defaults = {
    title: 'ظرافت، در هر جزئیات',
    href: '/products',
    label: 'مشاهده همه محصولات',
  }

  if (!section.imagePath) {
    return <HeroPlain section={section} design={design} defaults={defaults} />
  }

  return (
    <BannerFrame
      section={section}
      design={design}
      heading="h1"
      priority
      canOverlayHeader
      defaults={defaults}
    />
  )
}

function HeroPlain({
  section,
  design,
  defaults,
}: {
  section: Section
  design: BannerSettings
  defaults: BannerProps['defaults']
}) {
  return (
    <section
      className={`relative flex flex-col overflow-hidden border-b border-line bg-bg-secondary ${
        design.header === 'overlay' ? 'hero-overlay' : ''
      } ${BANNER_HEIGHT_CLASS[design.height]} ${BANNER_POSITION_CLASS[design.position]}`}
      data-banner-tone="dark"
      data-banner-position={design.position}
    >
      <OrchidSpray
        seed={1}
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -end-24 h-[26rem] w-[26rem] text-accent/[0.10] sm:h-[34rem] sm:w-[34rem]"
      />
      <OrchidSpray
        seed={2}
        aria-hidden="true"
        className="pointer-events-none absolute -start-24 -top-28 hidden h-80 w-80 rotate-180 text-accent/[0.07] lg:block"
      />

      <div className="container-page relative flex w-full flex-col">
        <div className={`flex w-full flex-col ${BANNER_ALIGN_CLASS[design.align]}`}>
          <div className="max-w-2xl">
            <BannerCopy
              section={section}
              design={{ ...design, tone: 'dark' }}
              heading="h1"
              defaults={defaults}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function BannerCopy({ section, design, heading, defaults }: BannerProps) {
  const light = design.tone === 'light'
  const Heading = heading

  const href = section.linkUrl && section.linkUrl !== '/' ? section.linkUrl : defaults.href
  const label = section.linkLabel || defaults.label

  const alignSelf =
    design.align === 'center' ? 'justify-center' : design.align === 'end' ? 'justify-end' : ''
  const blockAlign = design.align === 'center' ? 'mx-auto' : design.align === 'end' ? 'ms-auto' : ''

  return (
    <>
      {design.eyebrow && (
        <p className={`eyebrow animate-rise ${light ? 'text-white/80' : ''} ${alignSelf}`}>
          {design.eyebrow}
        </p>
      )}

      <Heading
        className={`banner-title mt-5 animate-rise [animation-delay:80ms] ${
          light ? 'text-white' : 'text-ink'
        }`}
        style={light ? { textShadow: '0 1px 28px rgba(0,0,0,0.30)' } : undefined}
      >
        {section.title || defaults.title}
      </Heading>

      {section.subtitle && (
        <p
          className={`mt-5 max-w-lg animate-rise text-base leading-relaxed [animation-delay:160ms] md:text-lg ${
            light ? 'text-white/85' : 'text-ink-muted'
          } ${blockAlign}`}
        >
          {section.subtitle}
        </p>
      )}

      <div className={`mt-9 flex animate-rise [animation-delay:240ms] ${alignSelf}`}>
        <BannerCta href={href} label={label} ctaStyle={design.ctaStyle} light={light} />
      </div>
    </>
  )
}

function BannerCta({
  href,
  label,
  ctaStyle,
  light,
}: {
  href: string
  label: string
  ctaStyle: BannerSettings['ctaStyle']
  light: boolean
}) {
  const arrow = (
    <span aria-hidden="true" className="mirror-rtl text-[1.05em] leading-none">
      →
    </span>
  )

  if (ctaStyle === 'link') {
    return (
      <Link
        href={href}
        className={`banner-link text-[15px] font-medium ${light ? 'text-white' : 'text-ink'}`}
      >
        {label}
        {arrow}
      </Link>
    )
  }

  if (ctaStyle === 'solid') {
    return (
      <Link href={href} className="btn btn-primary px-8 py-3.5">
        {label}
        {arrow}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={`banner-cta inline-flex items-center gap-3 rounded-full px-8 py-3.5 text-[15px] font-medium ${
        light ? 'banner-cta-light' : 'banner-cta-dark'
      }`}
    >
      {label}
      {arrow}
    </Link>
  )
}

async function Categories({ section }: { section: Section }) {
  const categories = (await listCategories()).filter((c) => c.parentId === null).slice(0, 6)
  if (categories.length === 0) return null

  return (
    <section className="movement container-page">
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <clipPath id="orchid-arch" clipPathUnits="objectBoundingBox">
            <path d="M0,1 L0,0.58 C0.01,0.34 0.16,0.1 0.5,0 C0.84,0.1 0.99,0.34 1,0.58 L1,1 Z" />
          </clipPath>
        </defs>
      </svg>

      <SectionHeading
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
            className="group/cat w-[52vw] text-center sm:w-[34vw] md:w-auto"
          >
            <div className="arch relative aspect-[3/4] overflow-hidden bg-surface-sunken">
              {category.imagePath ? (
                <ResponsiveImage
                  path={category.imagePath}
                  alt={category.name}
                  width={600}
                  height={800}
                  sizes="(min-width: 768px) 20vw, 52vw"
                  className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/cat:scale-[1.05]"
                />
              ) : (
                <ImagePlaceholder
                  width={600}
                  height={800}
                  seed={category.id}
                  className="h-full w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/cat:scale-[1.05]"
                />
              )}
            </div>

            <h3 className="mt-4 font-[family-name:var(--font-body)] text-[15px] font-medium text-ink transition-colors duration-300 group-hover/cat:text-accent-2">
              {category.name}
            </h3>

            <span
              aria-hidden="true"
              className="mx-auto mt-2 block h-px w-4 bg-line-strong transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/cat:w-12 group-hover/cat:bg-accent-2"
            />
          </Link>
        ))}
      </div>
    </section>
  )
}

function PromoBanner({ section }: { section: Section }) {
  const design = parseBannerSettings(section.config)

  const defaults = {
    title: 'ارسال محرمانه به سراسر ایران',
    href: '/products',
    label: 'مشاهده',
  }

  if (section.imagePath) {
    return (
      <BannerFrame section={section} design={design} heading="h2" defaults={defaults} />
    )
  }

  const alignSelf =
    design.align === 'center' ? 'justify-center' : design.align === 'end' ? 'justify-end' : ''
  const blockAlign = design.align === 'center' ? 'mx-auto' : design.align === 'end' ? 'ms-auto' : ''

  return (
    <section className="band">
      <div className="movement container-page">
        <div className={`flex flex-col ${BANNER_ALIGN_CLASS[design.align]}`}>
          <div className="max-w-xl">
            {design.eyebrow && (
              <p className={`eyebrow mb-4 text-on-accent/70 ${alignSelf}`}>{design.eyebrow}</p>
            )}

            <h2 className="font-[family-name:var(--font-heading)] text-3xl leading-tight md:text-[3rem]">
              {section.title || defaults.title}
            </h2>

            {section.subtitle && (
              <p className={`mt-5 max-w-md leading-loose text-on-accent/80 ${blockAlign}`}>
                {section.subtitle}
              </p>
            )}

            <div className={`mt-9 flex ${alignSelf}`}>
              <BannerCta
                href={section.linkUrl || defaults.href}
                label={section.linkLabel || defaults.label}
                ctaStyle={design.ctaStyle === 'solid' ? 'outline' : design.ctaStyle}
                light
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function BrandStory({ section }: { section: Section }) {
  return (
    <section className="movement-open container-page">
      <div className="grid gap-10 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5">
          <span aria-hidden="true" className="mb-9 block h-px w-14 bg-accent-2" />
          {section.title && <h2 className="display-title text-ink">{section.title}</h2>}
        </div>

        <div className="md:col-span-6 md:col-start-7 md:pt-4">
          {section.subtitle && (
            <p className="text-lg leading-loose text-ink-muted">{section.subtitle}</p>
          )}
          {section.linkUrl && (
            <Link href={section.linkUrl} className="link-rule mt-9">
              {section.linkLabel || 'بیشتر بخوانید'}
              <span aria-hidden="true" className="mirror-rtl">
                →
              </span>
            </Link>
          )}
        </div>
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
    <section className="movement container-page">
      <SectionHeading
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
                className="nums mt-4 block text-xs text-ink-muted"
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
