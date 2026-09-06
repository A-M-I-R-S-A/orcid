import { redirect } from 'next/navigation'

import { AdminShell } from '@/components/admin/shell'
import { getCurrentAdmin } from '@/lib/session'
import { hasAnyPermission } from '@/lib/permissions'
import { pendingPaymentCount } from '@/modules/payments/service'
import { pendingCount as pendingReviewCount } from '@/modules/reviews/service'
import { pendingApprovalCount } from '@/modules/sms/service'

export const dynamic = 'force-dynamic'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')

  const [payments, reviews, sms] = await Promise.all([
    hasAnyPermission(admin, ['payments.view']) ? pendingPaymentCount() : Promise.resolve(0),
    hasAnyPermission(admin, ['reviews.view']) ? pendingReviewCount() : Promise.resolve(0),
    hasAnyPermission(admin, ['sms.view']) ? pendingApprovalCount() : Promise.resolve(0),
  ])

  return (
    <AdminShell
      admin={{
        fullName: admin.fullName,
        username: admin.username,
        roleKey: admin.roleKey,
        permissions: [...admin.permissions],
      }}
      badges={{ payments, reviews, sms }}
    >
      {children}
    </AdminShell>
  )
}
