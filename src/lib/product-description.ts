export interface ProductDescriptionFeature {
  title: string
  body: string
}

export interface ProductDescriptionData {
  version: 1
  eyebrow: string
  title: string
  intro: string
  sectionEyebrow: string
  sectionTitle: string
  sectionSubtitle: string
  features: ProductDescriptionFeature[]
  sizeLabel: string
  sizeValue: string
  fitLabel: string
  fitValue: string
  guideTitle: string
  guideBody: string
  notice: string
}

export const EMPTY_PRODUCT_DESCRIPTION: ProductDescriptionData = {
  version: 1,
  eyebrow: '',
  title: '',
  intro: '',
  sectionEyebrow: '',
  sectionTitle: '',
  sectionSubtitle: '',
  features: Array.from({ length: 4 }, () => ({ title: '', body: '' })),
  sizeLabel: '',
  sizeValue: '',
  fitLabel: '',
  fitValue: '',
  guideTitle: '',
  guideBody: '',
  notice: '',
}

const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''

export function parseProductDescription(raw: string | null | undefined): ProductDescriptionData {
  if (!raw?.trim()) return { ...EMPTY_PRODUCT_DESCRIPTION, features: EMPTY_PRODUCT_DESCRIPTION.features.map((item) => ({ ...item })) }
  try {
    const value = JSON.parse(raw) as Partial<ProductDescriptionData>
    if (value.version !== 1) throw new Error('legacy')
    return {
      version: 1,
      eyebrow: text(value.eyebrow, 80),
      title: text(value.title, 220),
      intro: text(value.intro, 3000),
      sectionEyebrow: text(value.sectionEyebrow, 80),
      sectionTitle: text(value.sectionTitle, 160),
      sectionSubtitle: text(value.sectionSubtitle, 500),
      features: Array.from({ length: 4 }, (_, index) => ({
        title: text(value.features?.[index]?.title, 100),
        body: text(value.features?.[index]?.body, 500),
      })),
      sizeLabel: text(value.sizeLabel, 80),
      sizeValue: text(value.sizeValue, 160),
      fitLabel: text(value.fitLabel, 80),
      fitValue: text(value.fitValue, 160),
      guideTitle: text(value.guideTitle, 140),
      guideBody: text(value.guideBody, 1200),
      notice: text(value.notice, 1000),
    }
  } catch {
    return { ...EMPTY_PRODUCT_DESCRIPTION, intro: raw.trim().slice(0, 3000), features: EMPTY_PRODUCT_DESCRIPTION.features.map((item) => ({ ...item })) }
  }
}

export function serializeProductDescription(value: ProductDescriptionData): string | null {
  const clean = parseProductDescription(JSON.stringify({ ...value, version: 1 }))
  const hasContent = Object.entries(clean).some(([key, item]) => key !== 'version' && (Array.isArray(item) ? item.some((feature) => feature.title || feature.body) : Boolean(item)))
  return hasContent ? JSON.stringify(clean) : null
}
