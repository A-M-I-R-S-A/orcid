import { redirect } from 'next/navigation'

import { LoginForm } from '@/components/login-form'
import { getCurrentUser } from '@/lib/session'

/**
 * Login. §23 / §70.
 *
 * noindex — an authentication page has no search value and appearing in
 * results for the brand name would be actively unhelpful.
 */
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

  if (user) redirect(next && next.startsWith('/') ? next : '/account')

  return (
    <div className="container-page py-16 md:py-24">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl text-ink">ورود یا ثبت‌نام</h1>
          <p className="mt-3 text-ink-muted leading-relaxed">
            شماره موبایل خود را وارد کنید. کد تأیید برای شما پیامک می‌شود.
          </p>
        </div>

        {/*
          `next` is validated to be a relative path before it reaches the
          client — an absolute URL here would turn login into an open redirect.
        */}
        <LoginForm next={next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'} />
      </div>
    </div>
  )
}
