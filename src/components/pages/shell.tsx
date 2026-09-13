import Link from 'next/link'

import { ResponsiveImage } from '@/components/media'
import { OrchidSpray } from '@/components/ornament'
import { Breadcrumbs } from '@/components/ui'
import { SiteStyledText } from '@/components/site-content-provider'

export function ArchClip() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="absolute">
      <defs>
        <clipPath id="orchid-arch" clipPathUnits="objectBoundingBox">
          <path d="M0,1 L0,0.58 C0.01,0.34 0.16,0.1 0.5,0 C0.84,0.1 0.99,0.34 1,0.58 L1,1 Z" />
        </clipPath>
      </defs>
    </svg>
  )
}

export interface BandLink {
  label: string
  href: string
  primary?: boolean
}

export function BandLinks({ links, tone }: { links: BandLink[]; tone: 'dark' | 'accent' }) {
  const primary =
    tone === 'dark'
      ? 'bg-ink text-bg hover:bg-ink/90'
      : 'bg-on-accent text-accent hover:bg-on-accent/90'

  const secondary =
    tone === 'dark'
      ? 'border border-line-strong text-ink hover:border-ink hover:bg-ink/10'
      : 'border border-on-accent/50 text-on-accent hover:border-on-accent hover:bg-on-accent/10'

  return (
    <div className="flex flex-wrap gap-4">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`inline-flex items-center gap-3 rounded-full px-8 py-3.5 text-[15px] font-medium transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            link.primary ? primary : secondary
          }`}
        >
          {link.label}
          <span aria-hidden="true" className="mirror-rtl">
            →
          </span>
        </Link>
      ))}
    </div>
  )
}

export function PageHero({
  eyebrow,
  title,
  lead,
  imagePath,
  breadcrumbs,
  aside,
  links,
  contentKeys,
}: {
  eyebrow: string
  title: string
  lead?: string
  imagePath?: string | null
  breadcrumbs: { name: string; path: string }[]
  aside?: React.ReactNode
  links?: BandLink[]
  contentKeys?: { eyebrow?: string; title?: string; lead?: string }
}) {
  const hasVisual = Boolean(imagePath) || Boolean(aside)

  return (
    <section className="on-dark relative isolate overflow-hidden">
      <ArchClip />

      <OrchidSpray
        seed={3}
        className="pointer-events-none absolute -bottom-32 -start-28 h-[30rem] w-[30rem] text-accent/[0.08]"
      />
      <OrchidSpray
        seed={5}
        className="pointer-events-none absolute -end-24 -top-32 hidden h-[26rem] w-[26rem] rotate-180 text-accent/[0.06] lg:block"
      />

      <div className="container-page relative pb-16 pt-8 md:pb-24 md:pt-10">
        <Breadcrumbs items={breadcrumbs} />

        <div
          className={`mt-14 grid gap-12 md:mt-20 ${hasVisual ? 'lg:grid-cols-12 lg:items-end lg:gap-16' : ''}`}
        >
          <div className={hasVisual ? 'lg:col-span-7' : 'max-w-3xl'}>
            <p className="eyebrow animate-rise">
              {contentKeys?.eyebrow ? <SiteStyledText contentKey={contentKeys.eyebrow}>{eyebrow}</SiteStyledText> : eyebrow}
            </p>

            <h1 className="display-title mt-6 animate-rise text-ink [animation-delay:80ms]">
              {contentKeys?.title ? <SiteStyledText contentKey={contentKeys.title}>{title}</SiteStyledText> : title}
            </h1>

            {lead && (
              <p className="mt-8 max-w-xl animate-rise text-lg leading-loose text-ink-muted [animation-delay:160ms]">
                {contentKeys?.lead ? <SiteStyledText contentKey={contentKeys.lead}>{lead}</SiteStyledText> : lead}
              </p>
            )}

            {links && links.length > 0 && (
              <div className="mt-11 animate-rise [animation-delay:240ms]">
                <BandLinks links={links} tone="dark" />
              </div>
            )}
          </div>

          {hasVisual && (
            <div className="lg:col-span-4 lg:col-start-9">
              {imagePath ? (
                <div className="arch relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden bg-surface-sunken lg:max-w-none">
                  <ResponsiveImage
                    path={imagePath}
                    alt={title}
                    width={720}
                    height={960}
                    sizes="(min-width: 1024px) 28rem, 20rem"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                aside
              )}
            </div>
          )}
        </div>
      </div>

      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-line-strong/60" />
    </section>
  )
}

export function Movement({
  children,
  tone = 'plain',
  className,
  id,
}: {
  children: React.ReactNode
  tone?: 'plain' | 'raised' | 'sunken'
  className?: string
  id?: string
}) {
  const ground =
    tone === 'raised'
      ? 'border-y border-line bg-surface'
      : tone === 'sunken'
        ? 'border-y border-line bg-surface-sunken/50'
        : ''

  return (
    <section id={id} className={`movement ${ground} ${className ?? ''}`}>
      <div className="container-page">{children}</div>
    </section>
  )
}

export function ClosingBand({
  eyebrow,
  title,
  body,
  links,
}: {
  eyebrow: string
  title: string
  body?: string
  links: BandLink[]
}) {
  return (
    <section className="band relative isolate overflow-hidden">
      <OrchidSpray
        seed={7}
        className="pointer-events-none absolute -bottom-28 -end-20 h-[24rem] w-[24rem] text-on-accent/[0.09]"
      />

      <div className="container-page relative py-20 md:py-28">
        <div className="max-w-2xl">
          <p className="eyebrow text-on-accent/75">{eyebrow}</p>
          <h2 className="section-title mt-6 text-on-accent">{title}</h2>
          {body && <p className="mt-6 max-w-lg leading-loose text-on-accent/75">{body}</p>}

          <div className="mt-10">
            <BandLinks links={links} tone="accent" />
          </div>
        </div>
      </div>
    </section>
  )
}

export function RelatedPages({
  pages,
  heading,
}: {
  pages: { slug: string; title: string }[]
  heading: string
}) {
  if (pages.length === 0) return null

  return (
    <Movement tone="raised">
      <p className="eyebrow">{heading}</p>

      <div className="mt-9 flex flex-wrap gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line">
        {pages.map((page) => (
          <Link
            key={page.slug}
            href={`/p/${encodeURIComponent(page.slug)}`}
            className="group flex flex-1 basis-60 items-center justify-between gap-4 bg-surface px-6 py-7 transition-colors hover:bg-surface-raised"
          >
            <span className="text-[15px] leading-snug text-ink transition-colors group-hover:text-accent-2">
              {page.title}
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
  )
}
