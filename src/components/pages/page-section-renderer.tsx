import Link from 'next/link'

import { ResponsiveImage } from '@/components/media'
import { sanitizeHtml } from '@/lib/sanitize'
import type { PageSectionRecord } from '@/lib/page-sections'

const backgrounds = {
  plain: '',
  raised: 'border-y border-line bg-surface',
  sunken: 'border-y border-line bg-surface-sunken/50',
  dark: 'on-dark bg-ink',
  accent: 'bg-accent text-on-accent',
} as const

const spacing = { none: 'py-0', sm: 'py-8 md:py-12', md: 'py-14 md:py-20', lg: 'py-20 md:py-28' } as const

function Action({ label, href }: { label: string | null; href: string | null }) {
  if (!label || !href) return null
  return <Link href={href} className="btn btn-primary mt-7">{label}</Link>
}

export function PageSectionRenderer({ sections }: { sections: PageSectionRecord[] }) {
  return <>{[...sections].filter((section) => section.isVisible).sort((a, b) => a.sortOrder - b.sortOrder).map((section) => {
    const config = section.config ?? {}
    const centered = config.alignment === 'center'
    const ground = backgrounds[section.background]
    const rhythm = spacing[section.spacing]
    const textTone = section.background === 'dark' || section.background === 'accent' ? 'text-current' : 'text-ink'

    if (section.kind === 'hero') return <section key={section.id} className={`${ground} ${rhythm}`}><div className={`container-page ${centered ? 'mx-auto max-w-4xl text-center' : ''}`}><div className="grid items-center gap-10 lg:grid-cols-12"><div className={section.imagePath ? 'lg:col-span-7' : 'lg:col-span-12'}>{section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}<h2 className={`display-title mt-5 ${textTone}`}>{section.title}</h2>{section.subtitle && <p className="mt-6 max-w-2xl whitespace-pre-line text-lg leading-loose opacity-75">{section.subtitle}</p>}<Action label={section.linkLabel} href={section.linkUrl} /></div>{section.imagePath && <div className="lg:col-span-5"><ResponsiveImage path={section.imagePath} alt={section.title ?? ''} width={900} height={700} sizes="(min-width: 1024px) 40vw, 100vw" className="h-auto w-full rounded-[var(--radius-card)] object-cover" /></div>}</div></div></section>

    if (section.kind === 'rich_text') return <section key={section.id} className={`${ground} ${rhythm}`}><div className="container-page"><div className={`prose max-w-3xl ${centered ? 'mx-auto text-center' : ''}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.body ?? '') }} /></div></section>

    if (section.kind === 'text_image') { const imageFirst = config.imagePosition === 'start'; const copy = <div><p className="eyebrow">{section.eyebrow}</p><h2 className={`section-title mt-5 ${textTone}`}>{section.title}</h2>{section.body && <div className="prose mt-6 opacity-80" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.body) }} />}<Action label={section.linkLabel} href={section.linkUrl} /></div>; const image = section.imagePath ? <ResponsiveImage path={section.imagePath} alt={section.title ?? ''} width={900} height={700} sizes="(min-width: 768px) 50vw, 100vw" className="h-auto w-full rounded-[var(--radius-card)] object-cover" /> : null; return <section key={section.id} className={`${ground} ${rhythm}`}><div className="container-page grid items-center gap-10 md:grid-cols-2">{imageFirst ? <>{image}{copy}</> : <>{copy}{image}</>}</div></section> }

    if (section.kind === 'cards' || section.kind === 'features') { const columns = config.columns ?? 3; return <section key={section.id} className={`${ground} ${rhythm}`}><div className="container-page">{section.eyebrow && <p className={`eyebrow ${centered ? 'text-center' : ''}`}>{section.eyebrow}</p>}<h2 className={`section-title mt-5 ${centered ? 'text-center' : ''} ${textTone}`}>{section.title}</h2>{section.subtitle && <p className={`mt-5 opacity-75 ${centered ? 'text-center' : ''}`}>{section.subtitle}</p>}<div className={`mt-10 grid gap-5 ${columns === 2 ? 'md:grid-cols-2' : columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>{(config.items ?? []).map((item, index) => <article key={`${item.title}-${index}`} className="card p-6"><h3 className="text-xl text-ink">{item.title}</h3><p className="mt-3 whitespace-pre-line leading-loose text-ink-muted">{item.body}</p>{item.linkLabel && item.linkUrl && <Link href={item.linkUrl} className="mt-5 inline-flex text-sm text-accent-2">{item.linkLabel}</Link>}</article>)}</div></div></section> }

    return <section key={section.id} className={`${ground} ${rhythm}`}><div className={`container-page ${centered ? 'text-center' : ''}`}><p className="eyebrow">{section.eyebrow}</p><h2 className={`section-title mt-5 ${textTone}`}>{section.title}</h2>{section.body && <p className="mt-5 whitespace-pre-line leading-loose opacity-80">{section.body}</p>}<Action label={section.linkLabel} href={section.linkUrl} /></div></section>
  })}</>
}
