'use client'

import { useState, useTransition } from 'react'

import { changePasswordAction } from '@/modules/auth/actions'
import { updateProfileAction } from '@/modules/account/actions'
import { PasswordField } from '@/components/auth/fields'

export function ProfileForm({
  defaults,
}: {
  defaults: { fullName: string; email: string; phone: string }
}) {
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

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
      <h2 className="text-lg text-ink">اطلاعات شخصی</h2>

      <div>
        <label htmlFor="p-name" className="label">
          نام و نام خانوادگی
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
          ایمیل <span className="font-normal text-ink-subtle">(اختیاری)</span>
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
        <span className="label">شماره موبایل</span>
        <p className="nums rounded-md bg-surface-sunken px-4 py-3 text-ink" dir="ltr">
          {defaults.phone}
        </p>
        <p className="hint">
          شماره موبایل شناسه حساب شماست. برای تغییر آن با پشتیبانی تماس بگیرید.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-md bg-success-bg px-4 py-3 text-sm text-success">
          اطلاعات شما ذخیره شد.
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
      </button>
    </form>
  )
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
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
        <h2 className="text-lg text-ink">{hasPassword ? 'تغییر رمز عبور' : 'انتخاب رمز عبور'}</h2>
        {!hasPassword && (
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            حساب شما هنوز رمز عبور ندارد. با انتخاب رمز، می‌توانید بدون کد پیامکی هم وارد شوید.
          </p>
        )}
      </div>

      {hasPassword && (
        <PasswordField
          label="رمز عبور فعلی"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          invalid={Boolean(error)}
          disabled={pending}
        />
      )}

      <PasswordField
        label="رمز عبور جدید"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        hint="حداقل ۸ کاراکتر."
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
          رمز عبور تغییر کرد. سایر دستگاه‌ها از حساب خارج شدند.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || next.length < 8 || (hasPassword && current.length < 1)}
        className="btn btn-primary"
      >
        {pending ? 'در حال ذخیره…' : hasPassword ? 'تغییر رمز عبور' : 'ثبت رمز عبور'}
      </button>
    </form>
  )
}
