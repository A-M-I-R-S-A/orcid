import { LogoutButton } from '@/components/logout-button'
import { PasswordForm, ProfileForm } from '@/components/account/profile-forms'
import { getProfile } from '@/modules/account/service'
import { requireUser } from '@/lib/session'
import { formatJalali } from '@/lib/jalali'

export const metadata = { title: 'اطلاعات حساب' }

export default async function ProfilePage() {
  const user = await requireUser()
  const profile = await getProfile(user.id)

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-3">حساب کاربری</p>
        <h1 className="section-title">اطلاعات حساب</h1>
        <p className="nums mt-3 text-sm text-ink-subtle">
          عضو ارکید از {formatJalali(profile.createdAt)}
        </p>
      </header>

      <ProfileForm
        defaults={{
          fullName: profile.fullName ?? '',
          email: profile.email ?? '',
          phone: profile.phone,
        }}
      />

      <PasswordForm hasPassword={profile.hasPassword} />

      <div className="card p-2 lg:hidden">
        <LogoutButton />
      </div>
    </div>
  )
}
