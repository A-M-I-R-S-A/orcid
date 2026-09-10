import { db } from '@/db'
import { navLinks } from '@/db/schema'
import { PageHeader } from '@/components/admin/ui'
import { LogoManager, NavPlacementEditor } from '@/components/admin/nav-manager'
import { requirePermission } from '@/modules/admin/auth'
import { getCurrentAdmin } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { getNamespace } from '@/lib/settings'

export const metadata = { title: 'منو و فوتر' }

export default async function NavigationPage() {
  await requirePermission('content.navigation')
  const admin = await getCurrentAdmin()

  const [rows, site] = await Promise.all([
    db
      .select({
        id: navLinks.id,
        placement: navLinks.placement,
        label: navLinks.label,
        href: navLinks.href,
        isVisible: navLinks.isVisible,
        sortOrder: navLinks.sortOrder,
      })
      .from(navLinks)
      .orderBy(navLinks.sortOrder, navLinks.id),
    getNamespace('site'),
  ])

  const forPlacement = (placement: string) =>
    rows
      .filter((r) => r.placement === placement)
      .map(({ id, label, href, isVisible, sortOrder }) => ({
        id,
        label,
        href,
        isVisible,
        sortOrder,
      }))

  return (
    <>
      <PageHeader
        title="منو و فوتر"
        description="پیوندهای نوار بالای سایت و ستون‌های فوتر"
      />

      <div className="space-y-6">
        {admin && hasPermission(admin, 'appearance.brand') && (
          <LogoManager logoPath={site.logoPath || null} />
        )}

        <NavPlacementEditor
          placement="header"
          title="منوی اصلی"
          description="نوار ناوبری زیر هدر، در نمایش دسکتاپ و منوی موبایل."
          links={forPlacement('header')}
          fallbackNote="تا زمانی که پیوندی اضافه نکنید، شش دسته‌بندی اصلی به‌همراه راهنمای سایز و مجله به‌صورت خودکار نمایش داده می‌شوند."
        />

        <NavPlacementEditor
          placement="footer_shop"
          title="فوتر — ستون فروشگاه"
          description="ستون اول فوتر."
          links={forPlacement('footer_shop')}
          fallbackNote="تا زمانی که پیوندی اضافه نکنید، شش دسته‌بندی اصلی به‌صورت خودکار نمایش داده می‌شوند."
        />

        <NavPlacementEditor
          placement="footer_help"
          title="فوتر — ستون راهنما و پشتیبانی"
          description="ستون دوم فوتر."
          links={forPlacement('footer_help')}
          fallbackNote="تا زمانی که پیوندی اضافه نکنید، صفحاتی که «نمایش در فوتر» دارند به‌همراه پیگیری سفارش نمایش داده می‌شوند."
        />
      </div>
    </>
  )
}
