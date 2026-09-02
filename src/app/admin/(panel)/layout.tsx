import { redirect } from 'next/navigation'

import { AdminShell } from '@/components/admin/shell'
import { getCurrentAdmin } from '@/lib/session'
import { hasAnyPermission } from '@/lib/permissions'
import { pendingPaymentCount } from '@/modules/payments/service'
import { pendingCount as pendingReviewCount } from '@/modules/reviews/service'
import { pendingApprovalCount } from '@/modules/sms/service'

/**
 * Authenticated admin shell.
 *
 * The redirect here is a convenience, not the security control — every action
 * and service call re-checks permissions server-side (§57). If this layout
 * were removed entirely, nothing would become exploitable; the panel would
 * just render badly for a signed-out visitor.
 */
export const dynamic = 'force-dynamic'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')

  // Queue counts drive the navigation badges. Fetched once here rather than
  // per-page, so the operator always sees what is waiting from any screen.
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
