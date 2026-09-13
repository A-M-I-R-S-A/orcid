import { redirect } from 'next/navigation'

import { ResetForm } from '@/components/auth/reset-form'
import { AuthShell } from '@/components/auth/shell'
import { getCurrentUser } from '@/lib/session'
import { normalizePhone } from '@/lib/persian'
import { getSiteContent } from '@/lib/site-content'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const content = await getSiteContent()
  return {
  title: content.text('auth.forgot.title'),
  robots: { index: false, follow: false },
  }
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>
}) {
  const user = await getCurrentUser()
  if (user) redirect('/account/profile')

  const { phone } = await searchParams
  const content = await getSiteContent()

  return (
    <AuthShell
      title={content.text('auth.forgot.title')}
      subtitle={content.text('auth.forgot.description')}
    >
      <ResetForm initialPhone={(phone && normalizePhone(phone)) || ''} />
    </AuthShell>
  )
}
