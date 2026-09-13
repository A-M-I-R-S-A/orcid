'use client'

import { SiteStyledText } from '@/components/site-content-provider'
import { useState, useTransition } from 'react'

import { changePasswordAction } from '@/modules/auth/actions'
import { updateProfileAction } from '@/modules/account/actions'
import { PasswordField } from '@/components/auth/fields'
import { useSiteText } from '@/components/site-content-provider'

export function ProfileForm({
  defaults,
}: {
  defaults: { fullName: string; email: string; phone: string }
}) {
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  const t = useSiteText

  const submit = (formData: FormData) => {
    setError(null)
    setFieldErrors({})
    setSaved(false)

    startTransition(async () => {
      const result = await updateProfileAction({
        fullName: String(formData.get('fullName') ?? ''),
        email: String(formData.get('email') ?? ''),
      })

      if (result.ok) setSaved(true)
      else {
        setError(result.error)
        setFieldErrors(result.fieldErrors ?? {})
      }
    })
  }

  return (
    <form action={submit} className="card space-y-5 p-6">
      <h2 className="text-lg text-ink"><SiteStyledText contentKey="profile.personal">{t('profile.personal', 'اطلاعات شخصی')}</SiteStyledText></h2>

      <div>
        <label htmlFor="p-name" className="label">
          <SiteStyledText contentKey="auth.fullName">{t('auth.fullName', 'نام و نام خانوادگی')}</SiteStyledText>
        </label>
        <input
          id="p-name"
          name="fullName"
          defaultValue={defaults.fullName}
          required
          className="field"
          aria-invalid={Boolean(fieldErrors.fullName) || undefined}
        />
        {fieldErrors.fullName && <p className="field-error">{fieldErrors.fullName}</p>}
      </div>

      <div>
        <label htmlFor="p-email" className="label">
          <SiteStyledText contentKey="profile.email">{t('profile.email', 'ایمیل')}</SiteStyledText> <span className="font-normal text-ink-subtle">(<SiteStyledText contentKey="common.optional">{t('common.optional', 'اختیاری')}</SiteStyledText>)</span>
        </label>
        <input
          id="p-email"
          name="email"
          type="email"
          dir="ltr"
          defaultValue={defaults.email}
          className="field"
          aria-invalid={Boolean(fieldErrors.email) || undefined}
        />
        {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
      </div>

      <div>
        <span className="label"><SiteStyledText contentKey="auth.phone">{t('auth.phone', 'شماره موبایل')}</SiteStyledText></span>
        <p className="nums rounded-md bg-surface-sunken px-4 py-3 text-ink" dir="ltr">
          {defaults.phone}
        </p>
        <p className="hint">
          <SiteStyledText contentKey="profile.mobileIdentity">{t('profile.mobileIdentity', 'شماره موبایل شناسه حساب شماست. برای تغییر آن با پشتیبانی تماس بگیرید.')}</SiteStyledText>
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-md bg-success-bg px-4 py-3 text-sm text-success">
          <SiteStyledText contentKey="profile.saved">{t('profile.saved', 'اطلاعات شما ذخیره شد.')}</SiteStyledText>
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? t('common.saving', 'در حال ذخیره…') : t('profile.saveChanges', 'ذخیره تغییرات')}
      </button>
    </form>
  )
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useSiteText
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    setError(null)
    setSaved(false)

    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: hasPassword ? current : undefined,
        password: next,
      })

      if (result.ok) {
        setSaved(true)
        setCurrent('')
        setNext('')
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form
      className="card space-y-5 p-6"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div>
        <h2 className="text-lg text-ink">{hasPassword ? t('profile.changePassword', 'تغییر رمز عبور') : t('profile.choosePassword', 'انتخاب رمز عبور')}</h2>
        {!hasPassword && (
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            <SiteStyledText contentKey="profile.noPassword">{t('profile.noPassword', 'حساب شما هنوز رمز عبور ندارد. با انتخاب رمز، می‌توانید بدون کد پیامکی هم وارد شوید.')}</SiteStyledText>
          </p>
        )}
      </div>

      {hasPassword && (
        <PasswordField
          label={t('profile.currentPassword', 'رمز عبور فعلی')}
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          invalid={Boolean(error)}
          disabled={pending}
        />
      )}

      <PasswordField
        label={t('auth.newPassword', 'رمز عبور جدید')}
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        hint={t('auth.passwordHint', 'حداقل ۸ کاراکتر.')}
        invalid={Boolean(error)}
        disabled={pending}
      />

      {error && (
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-md bg-success-bg px-4 py-3 text-sm text-success">
          <SiteStyledText contentKey="profile.passwordChanged">{t('profile.passwordChanged', 'رمز عبور تغییر کرد. سایر دستگاه‌ها از حساب خارج شدند.')}</SiteStyledText>
        </p>
      )}

      <button
        type="submit"
        disabled={pending || next.length < 8 || (hasPassword && current.length < 1)}
        className="btn btn-primary"
      >
        {pending ? t('common.saving', 'در حال ذخیره…') : hasPassword ? t('profile.changePassword', 'تغییر رمز عبور') : t('profile.setPassword', 'ثبت رمز عبور')}
      </button>
    </form>
  )
}
