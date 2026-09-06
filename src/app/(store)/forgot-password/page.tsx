import { redirect } from 'next/navigation'

import { ResetForm } from '@/components/auth/reset-form'
import { AuthShell } from '@/components/auth/shell'
import { getCurrentUser } from '@/lib/session'
import { normalizePhone } from '@/lib/persian'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'بازیابی رمز عبور',
  robots: { index: false, follow: false },
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>
}) {
  const user = await getCurrentUser()
  if (user) redirect('/account/profile')

  const { phone } = await searchParams

  return (
    <AuthShell
      title="بازیابی رمز عبور"
      subtitle="کد تأیید برای شما پیامک می‌شود، سپس رمز جدید را انتخاب کنید."
    >
      <ResetForm initialPhone={(phone && normalizePhone(phone)) || ''} />
    </AuthShell>
  )
}
