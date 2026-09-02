import { redirect } from 'next/navigation'

import { AdminLoginForm } from '@/components/admin/login-form'
import { getCurrentAdmin } from '@/lib/session'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ورود مدیران',
  robots: { index: false, follow: false },
}

export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin()
  if (admin) redirect('/admin')

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-bg px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="ارکید"
            width={150}
            height={48}
            className="h-12 w-auto object-contain object-center mx-auto mb-6"
          />
          <h1 className="text-2xl text-ink">ورود به پنل مدیریت</h1>
        </div>

        <AdminLoginForm />
      </div>
    </div>
  )
}
