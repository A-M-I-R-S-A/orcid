import { redirect } from 'next/navigation'

import { RegisterForm } from '@/components/auth/register-form'
import { AuthShell } from '@/components/auth/shell'
import { getCurrentUser } from '@/lib/session'
import { safeNext } from '@/lib/redirects'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ثبت‌نام',
  robots: { index: false, follow: false },
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getCurrentUser()
  const { next } = await searchParams
  const target = safeNext(next)

  if (user) redirect(target)

  return (
    <AuthShell
      title="ساخت حساب کاربری"
      subtitle="برای ثبت سفارش و پیگیری آن، یک حساب بسازید."
    >
      <RegisterForm next={target} />
    </AuthShell>
  )
}
