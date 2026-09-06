import { PageHeader } from '@/components/admin/ui'
import { ThemeEditor, TypographyEditor } from '@/components/admin/appearance'
import { requirePermission } from '@/modules/admin/auth'
import { getCurrentAdmin } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { DEFAULT_THEME, THEME_FIELDS, getTheme } from '@/lib/theme'
import { AVAILABLE_FONTS, getTypography } from '@/lib/typography'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ظاهر سایت' }

export default async function AppearancePage() {
  await requirePermission('appearance.theme')
  const admin = await getCurrentAdmin()

  const [theme, typography] = await Promise.all([getTheme(), getTypography()])

  return (
    <>
      <PageHeader
        title="ظاهر سایت"
        description="رنگ‌بندی و تایپوگرافی فروشگاه. تغییرات بلافاصله در سایت اعمال می‌شود."
      />

      <div className="space-y-8">
        <ThemeEditor
          fields={THEME_FIELDS}
          current={theme}
          defaults={DEFAULT_THEME}
        />

        {admin && hasPermission(admin, 'appearance.typography') && (
          <TypographyEditor fonts={AVAILABLE_FONTS} current={typography} />
        )}
      </div>
    </>
  )
}
