import { asc } from 'drizzle-orm'

import { db } from '@/db'
import { homepageSections } from '@/db/schema'
import { PageHeader } from '@/components/admin/ui'
import { HomepageSectionEditor } from '@/components/admin/homepage-editor'
import { requirePermission } from '@/modules/admin/auth'
import { isBannerKind, parseBannerSettings } from '@/lib/banner'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'صفحه اصلی' }

const KIND_LABELS: Record<string, { label: string; hint: string }> = {
  hero: { label: 'بنر اصلی', hint: 'اولین چیزی که بازدیدکننده می‌بیند' },
  featured_products: { label: 'محصولات منتخب', hint: 'محصولاتی که برچسب «منتخب» دارند' },
  categories: { label: 'دسته‌بندی‌ها', hint: 'دسته‌بندی‌های سطح اول' },
  new_arrivals: { label: 'تازه رسیده‌ها', hint: 'محصولاتی که برچسب «تازه رسیده» دارند' },
  bestsellers: { label: 'پرفروش‌ترین‌ها', hint: 'محصولاتی که برچسب «پرفروش» دارند' },
  promo_banner: { label: 'بنر تبلیغاتی', hint: 'بنر تمام‌عرض با رنگ اصلی برند' },
  brand_story: { label: 'معرفی برند', hint: 'متن کوتاه درباره ارکید' },
  reviews: { label: 'دیدگاه مشتریان', hint: 'دیدگاه‌های تأییدشده' },
  blog_teaser: { label: 'مجله', hint: 'آخرین نوشته‌های وبلاگ' },
  newsletter: { label: 'خبرنامه', hint: 'فرم عضویت در خبرنامه' },
}

export default async function AdminHomepagePage() {
  await requirePermission('content.homepage')

  const sections = await db
    .select()
    .from(homepageSections)
    .orderBy(asc(homepageSections.sortOrder))

  return (
    <>
      <PageHeader
        title="صفحه اصلی"
        description="ترتیب، نمایش و محتوای بخش‌های صفحه اصلی"
      />

      <div className="space-y-4">
        {sections.map((section) => (
          <HomepageSectionEditor
            key={section.id}
            section={{
              id: section.id,
              kind: section.kind,
              label: KIND_LABELS[section.kind]?.label ?? section.kind,
              hint: KIND_LABELS[section.kind]?.hint ?? '',
              title: section.title,
              subtitle: section.subtitle,
              linkUrl: section.linkUrl,
              linkLabel: section.linkLabel,
              imagePath: section.imagePath,
              isVisible: section.isVisible,
              sortOrder: section.sortOrder,
              supportsImage: isBannerKind(section.kind),
            }}
            design={isBannerKind(section.kind) ? parseBannerSettings(section.config) : undefined}
            canOverlayHeader={section.kind === 'hero'}
          />
        ))}
      </div>
    </>
  )
}
