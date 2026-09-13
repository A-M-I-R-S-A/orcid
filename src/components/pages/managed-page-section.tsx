import type { ReactNode } from 'react'
import { PageSectionRenderer } from './page-section-renderer'
import type { PageSectionRecord } from '@/lib/page-sections'

export function ManagedPageSection({ section, children }: { section: PageSectionRecord; children: ReactNode }) {
  if (!section.isVisible) return null
  const backgrounds = { plain: '', raised: 'bg-surface', sunken: 'bg-surface-sunken/50', dark: 'on-dark bg-ink', accent: 'bg-accent text-on-accent' }
  const spacing = { none: '', sm: 'py-3 md:py-5', md: 'py-6 md:py-9', lg: 'py-10 md:py-14' }
  return <div className={`${backgrounds[section.background]} ${spacing[section.spacing]}`} style={{ order: section.sortOrder }}>{children}</div>
}

export function AdditionalManagedSections({ sections }: { sections: PageSectionRecord[] }) {
  return sections.filter((section) => !section.config?.slot).map((section) => (
    <div key={section.id} style={{ order: section.sortOrder }}><PageSectionRenderer sections={[section]} /></div>
  ))
}

export function ManagedTemplateSections({ pageId, sections, defaults, children }: {
  pageId: number
  sections: PageSectionRecord[]
  defaults: import('@/lib/page-sections').SystemPageSectionDefault[]
  children: ReactNode
}) {
  const nodes = Array.isArray(children) ? children : [children]
  // Defaults and template children deliberately share the same index.
  const system = defaults.map((item, index) => {
    const saved = sections.find((section) => section.config?.slot === item.slot)
    const section = saved ?? ({ id: -(index + 1), pageId, kind: item.kind, name: item.name, eyebrow: null,
      title: null, subtitle: null, body: null, imagePath: null, linkLabel: null, linkUrl: null,
      config: { slot: item.slot, locked: true }, background: item.background ?? 'plain',
      spacing: item.spacing ?? 'md', isVisible: true, sortOrder: item.sortOrder } satisfies PageSectionRecord)
    return <ManagedPageSection key={item.slot} section={section}>{nodes[index] ?? null}</ManagedPageSection>
  })
  return <div className="flex flex-col">{system}<AdditionalManagedSections sections={sections} /></div>
}
