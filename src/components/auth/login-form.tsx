'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { passwordLoginAction, requestOtpAction, verifyOtpAction } from '@/modules/auth/actions'
import {
  FormError,
  OtpField,
  PasswordField,
  PhoneField,
  ResendControl,
  SentToNotice,
  SubmitButton,
  useCountdown,
} from './fields'

type Mode = 'password' | 'otp'

export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('password')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useCountdown(0)
  const [pending, startTransition] = useTransition()

  const done = () => {
    router.push(next)
    router.refresh()
  }

  const switchMode = (value: Mode) => {
    setMode(value)
    setError(null)
    setCode('')
    setCodeSent(false)
  }

  const submitPassword = () => {
    setError(null)
    startTransition(async () => {
      const result = await passwordLoginAction({ phone, password })
      if (result.ok) done()
      else setError(result.error)
    })
  }

  const sendCode = () => {
    setError(null)
    startTransition(async () => {
      const result = await requestOtpAction({ phone, purpose: 'login' })
      if (result.ok) {
        setCodeSent(true)
        setCooldown(result.data.retryAfter)
      } else {
        setError(result.error)
      }
    })
  }

  const submitCode = (value: string) => {
    setError(null)
    startTransition(async () => {
      const result = await verifyOtpAction({ phone, code: value })
      if (result.ok) done()
      else {
        setError(result.error)
        setCode('')
      }
    })
  }

  if (mode === 'otp' && codeSent) {
    return (
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          submitCode(code)
        }}
      >
        <SentToNotice
          phone={phone}
          onEdit={() => {
            setCodeSent(false)
            setCode('')
            setError(null)
          }}
        />

        <OtpField
          value={code}
          onChange={setCode}
          onComplete={submitCode}
          invalid={Boolean(error)}
          disabled={pending}
        />

        <FormError message={error} />

        <SubmitButton pending={pending} disabled={code.length !== 6} pendingLabel="در حال بررسی…">
          ورود
        </SubmitButton>

        <ResendControl seconds={cooldown} onResend={sendCode} disabled={pending} />
      </form>
    )
  }

  return (
    <div className="space-y-6">
      <ModeTabs mode={mode} onChange={switchMode} />

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (mode === 'password') submitPassword()
          else sendCode()
        }}
      >
        <PhoneField
          value={phone}
          onChange={setPhone}
          invalid={Boolean(error)}
          disabled={pending}
          autoFocus
        />

        {mode === 'password' && (
          <>
            <PasswordField
              label="رمز عبور"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              invalid={Boolean(error)}
              disabled={pending}
            />
            <div className="-mt-1 text-start">
              <Link
                href={phone.length === 11 ? `/forgot-password?phone=${phone}` : '/forgot-password'}
                className="text-sm text-accent-2 transition-colors hover:text-accent"
              >
                رمز عبور را فراموش کرده‌اید؟
              </Link>
            </div>
          </>
        )}

        <FormError message={error} />

        <SubmitButton
          pending={pending}
          disabled={mode === 'password' ? phone.length < 11 || password.length < 1 : phone.length < 11}
          pendingLabel={mode === 'password' ? 'در حال ورود…' : 'در حال ارسال…'}
        >
          {mode === 'password' ? 'ورود' : 'ارسال کد تأیید'}
        </SubmitButton>
      </form>

      <p className="border-t border-line pt-5 text-center text-sm text-ink-muted">
        حساب کاربری ندارید؟{' '}
        <Link href="/register" className="font-medium text-accent-2 hover:text-accent">
          ثبت‌نام کنید
        </Link>
      </p>
    </div>
  )
}

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const options: { value: Mode; label: string }[] = [
    { value: 'password', label: 'رمز عبور' },
    { value: 'otp', label: 'کد یک‌بار مصرف' },
  ]

  return (
    <div role="tablist" aria-label="روش ورود" className="grid grid-cols-2 gap-1 rounded-full bg-surface-sunken p-1">
      {options.map((option) => {
        const active = mode === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`rounded-full py-2.5 text-sm font-medium transition-colors duration-300 ${
              active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
