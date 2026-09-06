'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { confirmRegistrationAction, registerAction } from '@/modules/auth/actions'
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

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useCountdown(0)
  const [pending, startTransition] = useTransition()

  const detailsValid =
    fullName.trim().length >= 3 && phone.length === 11 && password.length >= 8

  const submitDetails = () => {
    setError(null)
    startTransition(async () => {
      const result = await registerAction({ fullName, phone, password })
      if (result.ok) {
        setStep('code')
        setCooldown(result.data.retryAfter)
      } else {
        setError(result.error)
      }
    })
  }

  const submitCode = (value: string) => {
    setError(null)
    startTransition(async () => {
      const result = await confirmRegistrationAction({ phone, code: value })
      if (result.ok) {
        router.push(next)
        router.refresh()
      } else {
        setError(result.error)
        setCode('')
      }
    })
  }

  if (step === 'code') {
    return (
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          submitCode(code)
        }}
      >
        <StepDots active={2} />

        <SentToNotice
          phone={phone}
          onEdit={() => {
            setStep('details')
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
          تأیید و ساخت حساب
        </SubmitButton>

        <ResendControl seconds={cooldown} onResend={submitDetails} disabled={pending} />
      </form>
    )
  }

  return (
    <div className="space-y-6">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          submitDetails()
        }}
      >
        <StepDots active={1} />

        <div>
          <label htmlFor="register-name" className="label">
            نام و نام خانوادگی
          </label>
          <input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            autoFocus
            disabled={pending}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="مثلاً شیرین محمدی"
            className="field"
            aria-invalid={Boolean(error) || undefined}
          />
        </div>

        <PhoneField value={phone} onChange={setPhone} invalid={Boolean(error)} disabled={pending} />

        <PasswordField
          label="رمز عبور"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="حداقل ۸ کاراکتر."
          invalid={Boolean(error)}
          disabled={pending}
        />

        <FormError message={error} />

        <SubmitButton pending={pending} disabled={!detailsValid} pendingLabel="در حال ارسال…">
          ادامه
        </SubmitButton>

        <p className="text-center text-xs leading-relaxed text-ink-subtle">
          با ثبت‌نام،{' '}
          <Link href="/p/terms" className="text-accent-2 hover:underline">
            قوانین و مقررات
          </Link>{' '}
          و{' '}
          <Link href="/p/privacy" className="text-accent-2 hover:underline">
            حریم خصوصی
          </Link>{' '}
          ارکید را می‌پذیرید.
        </p>
      </form>

      <p className="border-t border-line pt-5 text-center text-sm text-ink-muted">
        قبلاً ثبت‌نام کرده‌اید؟{' '}
        <Link href="/login" className="font-medium text-accent-2 hover:text-accent">
          وارد شوید
        </Link>
      </p>
    </div>
  )
}

function StepDots({ active }: { active: 1 | 2 }) {
  const steps = [
    { n: 1, label: 'مشخصات' },
    { n: 2, label: 'تأیید شماره' },
  ]

  return (
    <ol className="flex items-center gap-3" aria-label={`مرحله ${active} از ۲`}>
      {steps.map((step, i) => {
        const state = step.n === active ? 'current' : step.n < active ? 'done' : 'todo'
        return (
          <li key={step.n} className="flex flex-1 items-center gap-3">
            <span
              aria-current={state === 'current' ? 'step' : undefined}
              className={`nums flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                state === 'todo'
                  ? 'bg-surface-sunken text-ink-subtle'
                  : 'bg-accent text-on-accent'
              }`}
            >
              {state === 'done' ? '✓' : step.n === 1 ? '۱' : '۲'}
            </span>
            <span
              className={`text-xs ${state === 'current' ? 'font-medium text-ink' : 'text-ink-subtle'}`}
            >
              {step.label}
            </span>
            {i === 0 && <span aria-hidden="true" className="h-px flex-1 bg-line" />}
          </li>
        )
      })}
    </ol>
  )
}
