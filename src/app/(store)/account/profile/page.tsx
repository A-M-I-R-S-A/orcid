import { SiteStyledText } from '@/components/site-content-provider'
import { LogoutButton } from '@/components/logout-button'
import { PasswordForm, ProfileForm } from '@/components/account/profile-forms'
import { getProfile } from '@/modules/account/service'
import { requireUser } from '@/lib/session'
import { formatJalali } from '@/lib/jalali'
import { getSiteContent } from '@/lib/site-content'

export async function generateMetadata() { const content = await getSiteContent(); return { title: content.text('profile.title') } }

export default async function ProfilePage() {
  const user = await requireUser()
  const profile = await getProfile(user.id)
  const content = await getSiteContent()

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-3"><SiteStyledText contentKey="account.eyebrow">{content.text('account.eyebrow')}</SiteStyledText></p>
        <h1 className="section-title"><SiteStyledText contentKey="profile.title">{content.text('profile.title')}</SiteStyledText></h1>
        <p className="nums mt-3 text-sm text-ink-subtle">
          <SiteStyledText contentKey="profile.memberSince">{content.text('profile.memberSince')}</SiteStyledText> {formatJalali(profile.createdAt)}
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
