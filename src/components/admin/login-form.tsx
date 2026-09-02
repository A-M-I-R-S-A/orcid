'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { adminLoginAction } from '@/modules/admin/actions'

export function AdminLoginForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="card p-7 space-y-5"
      action={(formData) => {
        setError(null)
        startTransition(async () => {
          const result = await adminLoginAction({
            username: String(formData.get('username') ?? ''),
            password: String(formData.get('password') ?? ''),
          })

          if (result.ok) {
            router.push('/admin')
            router.refresh()
          } else {
            setError(result.error)
          }
        })
      }}
    >
      <div>
        <label htmlFor="username" className="label">
          نام کاربری
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          dir="ltr"
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          رمز عبور
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          dir="ltr"
          autoComplete="current-password"
          className="field"
        />
      </div>

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-block py-3.5">
        {pending ? 'در حال ورود…' : 'ورود'}
      </button>
    </form>
  )
}
