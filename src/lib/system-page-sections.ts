import type { SystemPageSectionDefault } from './page-sections'

export const SYSTEM_PAGE_SECTIONS: Record<'about' | 'contact' | 'faq', SystemPageSectionDefault[]> = {
  about: [
    { slot: 'about.hero', kind: 'hero', name: 'هدر درباره ارکید', sortOrder: 10, spacing: 'none' },
    { slot: 'about.stats', kind: 'features', name: 'آمار ارکید', sortOrder: 20, spacing: 'sm' },
    { slot: 'about.story', kind: 'rich_text', name: 'داستان ارکید', sortOrder: 30 },
    { slot: 'about.pillars', kind: 'features', name: 'قول‌ها و ارزش‌ها', sortOrder: 40, background: 'sunken' },
    { slot: 'about.policies', kind: 'cards', name: 'ارسال و بازگشت', sortOrder: 50 },
    { slot: 'about.related', kind: 'cards', name: 'صفحه‌های مرتبط', sortOrder: 60 },
    { slot: 'about.closing', kind: 'cta', name: 'دعوت پایانی', sortOrder: 70 },
  ],
  contact: [
    { slot: 'contact.hero', kind: 'hero', name: 'هدر تماس با ما', sortOrder: 10, spacing: 'none' },
    { slot: 'contact.channels', kind: 'cards', name: 'راه‌های ارتباطی', sortOrder: 20 },
    { slot: 'contact.place', kind: 'text_image', name: 'نشانی و ساعت پاسخ‌گویی', sortOrder: 30, background: 'sunken' },
    { slot: 'contact.body', kind: 'rich_text', name: 'توضیحات تماس', sortOrder: 40 },
    { slot: 'contact.shortcuts', kind: 'cards', name: 'میان‌برهای راهنما', sortOrder: 50, background: 'raised' },
    { slot: 'contact.closing', kind: 'cta', name: 'پیگیری سفارش', sortOrder: 60 },
  ],
  faq: [
    { slot: 'faq.hero', kind: 'hero', name: 'هدر پرسش‌های متداول', sortOrder: 10, spacing: 'none' },
    { slot: 'faq.questions', kind: 'rich_text', name: 'پرسش‌ها و پاسخ‌ها', sortOrder: 20 },
    { slot: 'faq.related', kind: 'cards', name: 'راهنماهای مرتبط', sortOrder: 30, background: 'raised' },
    { slot: 'faq.closing', kind: 'cta', name: 'دعوت پایانی', sortOrder: 40 },
  ],
}

export const GENERIC_PAGE_SECTIONS: SystemPageSectionDefault[] = [
  { slot: 'generic.header', kind: 'hero', name: 'عنوان و تصویر صفحه', sortOrder: 10, spacing: 'none' },
  { slot: 'generic.body', kind: 'rich_text', name: 'محتوای اصلی صفحه', sortOrder: 20, spacing: 'none' },
]
