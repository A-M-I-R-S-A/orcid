import { redirect } from 'next/navigation'

import { LoginForm } from '@/components/auth/login-form'
import { AuthShell } from '@/components/auth/shell'
import { getCurrentUser } from '@/lib/session'
import { safeNext } from '@/lib/redirects'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ورود به حساب کاربری',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
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
      title="ورود به حساب"
      subtitle="با رمز عبور یا کد یک‌بار مصرف وارد شوید."
    >
      <LoginForm next={target} />
    </AuthShell>
  )
}
