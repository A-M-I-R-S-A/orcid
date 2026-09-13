import { redirect } from 'next/navigation'

import { LoginForm } from '@/components/auth/login-form'
import { AuthShell } from '@/components/auth/shell'
import { getCurrentUser } from '@/lib/session'
import { safeNext } from '@/lib/redirects'
import { getSiteContent } from '@/lib/site-content'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const content = await getSiteContent()
  return {
  title: content.text('auth.login.title'),
  robots: { index: false, follow: false },
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getCurrentUser()
  const { next } = await searchParams
  const target = safeNext(next)
  const content = await getSiteContent()

  if (user) redirect(target)

  return (
    <AuthShell
      title={content.text('auth.login.title')}
      subtitle={content.text('auth.login.subtitle')}
    >
      <LoginForm next={target} />
    </AuthShell>
  )
}
