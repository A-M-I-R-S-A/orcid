'use client'

import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { requestPasswordResetAction, resetPasswordAction } from '@/modules/auth/actions'
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
import { useSiteText } from '@/components/site-content-provider'

export function ResetForm({ initialPhone = '' }: { initialPhone?: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'reset'>('phone')
  const [phone, setPhone] = useState(initialPhone)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useCountdown(0)
  const [pending, startTransition] = useTransition()
  const newPassword = useSiteText('auth.newPassword', 'رمز عبور جدید')
  const passwordHint = useSiteText('auth.passwordHint', 'حداقل ۸ کاراکتر.')
  const saving = useSiteText('auth.saving', 'در حال ذخیره…')
  const resetAndLogin = useSiteText('auth.resetAndLogin', 'تغییر رمز عبور و ورود')
  const sending = useSiteText('auth.sending', 'در حال ارسال…')
  const sendRecovery = useSiteText('auth.sendRecovery', 'ارسال کد بازیابی')
  const remembered = useSiteText('auth.remembered', 'رمز عبور را به یاد آوردید؟')
  const backToLogin = useSiteText('auth.backToLogin', 'بازگشت به ورود')

  const sendCode = () => {
    setError(null)
    startTransition(async () => {
      const result = await requestPasswordResetAction({ phone })
      if (result.ok) {
        setStep('reset')
        setCooldown(result.data.retryAfter)
      } else {
        setError(result.error)
      }
    })
  }

  const submitReset = () => {
    setError(null)
    startTransition(async () => {
      const result = await resetPasswordAction({ phone, code, password })
      if (result.ok) {
        router.push('/account')
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (step === 'reset') {
    return (
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          submitReset()
        }}
      >
        <SentToNotice
          phone={phone}
          onEdit={() => {
            setStep('phone')
            setCode('')
            setError(null)
          }}
        />

        <OtpField
          value={code}
          onChange={setCode}
          onComplete={() => {}}
          invalid={Boolean(error)}
          disabled={pending}
        />

        <PasswordField
          label={newPassword}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={passwordHint}
          invalid={Boolean(error)}
          disabled={pending}
        />

        <FormError message={error} />

        <SubmitButton
          pending={pending}
          disabled={code.length !== 6 || password.length < 8}
          pendingLabel={saving}
        >
          <SiteStyledText contentKey="auth.resetAndLogin">{resetAndLogin}</SiteStyledText>
        </SubmitButton>

        <ResendControl seconds={cooldown} onResend={sendCode} disabled={pending} />
      </form>
    )
  }

  return (
    <div className="space-y-6">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          sendCode()
        }}
      >
        <PhoneField
          value={phone}
          onChange={setPhone}
          invalid={Boolean(error)}
          disabled={pending}
          autoFocus
        />

        <FormError message={error} />

        <SubmitButton pending={pending} disabled={phone.length < 11} pendingLabel={sending}>
          <SiteStyledText contentKey="auth.sendRecovery">{sendRecovery}</SiteStyledText>
        </SubmitButton>
      </form>

      <p className="border-t border-line pt-5 text-center text-sm text-ink-muted">
        <SiteStyledText contentKey="auth.remembered">{remembered}</SiteStyledText>{' '}
        <Link href="/login" className="font-medium text-accent-2 hover:text-accent">
          <SiteStyledText contentKey="auth.backToLogin">{backToLogin}</SiteStyledText>
        </Link>
      </p>
    </div>
  )
}
