import type { ProductDescriptionData } from '@/lib/product-description'

export function ProductDescription({ data }: { data: ProductDescriptionData }) {
  const features = data.features.filter((item) => item.title || item.body)
  const hasDetails = data.sectionTitle || data.sectionSubtitle || features.length || data.sizeValue || data.fitValue

  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-[1.75rem] border border-line bg-surface px-4 py-8 shadow-sm sm:px-8 sm:py-12 lg:px-12">
      {(data.eyebrow || data.title || data.intro) && <header className="text-center sm:text-start">
        {data.eyebrow && <span className="inline-flex rounded-full border border-accent-3 bg-accent-3/15 px-3 py-1 text-xs text-accent-2">{data.eyebrow}</span>}
        {data.title && <h2 className="mt-5 text-xl leading-[1.7] text-ink sm:text-2xl">{data.title}</h2>}
        {data.intro && <p className="mt-5 whitespace-pre-line text-sm leading-8 text-ink-muted">{data.intro}</p>}
      </header>}

      {hasDetails && <section className="mt-9 rounded-2xl border border-accent-3/60 bg-bg/70 p-4 sm:mt-12 sm:p-7">
        {data.sectionEyebrow && <span className="inline-flex rounded-full bg-accent-3/15 px-3 py-1 text-[11px] text-accent-2">{data.sectionEyebrow}</span>}
        {data.sectionTitle && <h3 className="mt-4 text-lg text-ink sm:text-xl">{data.sectionTitle}</h3>}
        {data.sectionSubtitle && <p className="mt-2 text-xs leading-6 text-ink-muted sm:text-sm">{data.sectionSubtitle}</p>}

        {features.length > 0 && <div className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-4">
          {features.map((feature, index) => <article key={index} className="min-w-0 rounded-xl border border-accent-3/50 bg-surface p-3 sm:p-5">
            <span className="nums inline-flex rounded-md bg-accent-3/20 px-2 py-1 text-[10px] text-accent-2">{String(index + 1).padStart(2, '0')}</span>
            {feature.title && <h4 className="mt-3 break-words text-sm leading-6 text-ink sm:text-base">{feature.title}</h4>}
            {feature.body && <p className="mt-2 whitespace-pre-line break-words text-[11px] leading-6 text-ink-muted sm:text-sm">{feature.body}</p>}
          </article>)}
        </div>}

        {(data.sizeValue || data.fitValue) && <div className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-4">
          {[{ label: data.sizeLabel, value: data.sizeValue }, { label: data.fitLabel, value: data.fitValue }].filter((item) => item.label || item.value).map((item, index) => <div key={index} className="rounded-xl border border-accent-3/50 bg-surface p-3 sm:p-5">
            {item.label && <p className="text-[11px] text-ink-muted sm:text-xs">{item.label}</p>}
            {item.value && <strong className="mt-3 block break-words text-xs leading-6 text-ink sm:text-sm" dir="auto">{item.value}</strong>}
          </div>)}
        </div>}
      </section>}

      {(data.guideTitle || data.guideBody) && <aside className="mt-6 rounded-xl border border-accent-3/60 bg-bg/80 p-4 text-xs leading-7 text-ink-muted sm:text-sm">
        {data.guideTitle && <strong className="text-ink">{data.guideTitle}</strong>}{data.guideTitle && data.guideBody ? ' ' : ''}{data.guideBody}
      </aside>}
      {data.notice && <p className="mt-6 rounded-xl bg-accent px-4 py-4 text-center text-xs font-medium leading-7 text-on-accent sm:text-sm">{data.notice}</p>}
    </div>
  )
}
