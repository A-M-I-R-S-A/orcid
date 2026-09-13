export const PAGE_SECTION_KINDS = ['hero', 'rich_text', 'text_image', 'cards', 'features', 'cta'] as const
export const PAGE_SECTION_BACKGROUNDS = ['plain', 'raised', 'sunken', 'dark', 'accent'] as const
export const PAGE_SECTION_SPACING = ['none', 'sm', 'md', 'lg'] as const

export type PageSectionKind = (typeof PAGE_SECTION_KINDS)[number]
export type PageSectionBackground = (typeof PAGE_SECTION_BACKGROUNDS)[number]
export type PageSectionSpacing = (typeof PAGE_SECTION_SPACING)[number]

export interface PageSectionConfig {
  slot?: string
  locked?: boolean
  alignment?: 'start' | 'center'
  imagePosition?: 'start' | 'end'
  columns?: 2 | 3 | 4
  items?: { title: string; body: string; linkLabel?: string; linkUrl?: string }[]
}

export interface SystemPageSectionDefault {
  slot: string
  kind: PageSectionKind
  name: string
  sortOrder: number
  background?: PageSectionBackground
  spacing?: PageSectionSpacing
}

export interface PageSectionRecord {
  id: number
  pageId: number
  kind: PageSectionKind
  name: string
  eyebrow: string | null
  title: string | null
  subtitle: string | null
  body: string | null
  imagePath: string | null
  linkLabel: string | null
  linkUrl: string | null
  config: PageSectionConfig | null
  background: PageSectionBackground
  spacing: PageSectionSpacing
  isVisible: boolean
  sortOrder: number
}

export const PAGE_SECTION_DEFINITIONS: Record<PageSectionKind, { label: string; description: string }> = {
  hero: { label: 'هدر اصلی', description: 'عنوان، توضیح، تصویر و دکمه‌ی ابتدای صفحه' },
  rich_text: { label: 'متن کامل', description: 'محتوای HTML و متن طولانی' },
  text_image: { label: 'متن و تصویر', description: 'بخش دو ستونه با جای تصویر قابل انتخاب' },
  cards: { label: 'کارت‌ها', description: 'مجموعه‌ای از کارت‌های قابل ویرایش' },
  features: { label: 'ویژگی‌ها', description: 'مزیت‌ها یا قابلیت‌های صفحه' },
  cta: { label: 'دعوت به اقدام', description: 'عنوان، توضیح و دکمه پایانی' },
}

export function parseSectionItems(value: string): PageSectionConfig['items'] {
  if (!value.trim()) return []
  return value.split('\n').map((line) => {
    const [title = '', body = '', linkLabel = '', linkUrl = ''] = line.split('|').map((part) => part.trim())
    return { title, body, ...(linkLabel ? { linkLabel } : {}), ...(linkUrl ? { linkUrl } : {}) }
  }).filter((item) => item.title || item.body)
}
