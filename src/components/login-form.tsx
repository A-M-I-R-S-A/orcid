'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { requestOtpAction, verifyOtpAction } from '@/modules/auth/actions'
import { maskPhone, toLatinDigits, toPersianDigits } from '@/lib/persian'

/**
 * Two-step OTP login. §23 / §9.
 *
 * Mobile details that matter more than they look:
 *   inputMode="numeric"          — brings up the number pad, not the keyboard
 *   autoComplete="one-time-code" — lets iOS and Android autofill the SMS code
 *   dir="ltr" on the inputs      — digits enter left-to-right even in an RTL
 *                                  page, otherwise the caret jumps around
 *
 * Persian digits are converted on input, so a customer typing on a Persian
 * keyboard is never told their own phone number is invalid.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [pending, startTransition] = useTransition()

  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  const submitPhone = () => {
    setError(null)
    startTransition(async () => {
      const result = await requestOtpAction({ phone })
      if (result.ok) {
        setStep('code')
        setCooldown(result.data.retryAfter)
      } else {
        setError(result.error)
      }
    })
  }

  const submitCode = () => {
    setError(null)
    startTransition(async () => {
      const result = await verifyOtpAction({ phone, code })
      if (result.ok) {
        router.push(next)
        router.refresh()
      } else {
        setError(result.error)
        setCode('')
      }
    })
  }

  if (step === 'phone') {
    return (
      <form
        className="card p-7 space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          submitPhone()
        }}
      >
        <div>
          <label htmlFor="phone" className="label">
            شماره موبایل
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            dir="ltr"
            required
            value={phone}
            onChange={(event) => setPhone(toLatinDigits(event.target.value))}
            placeholder="09121234567"
            className="field text-center text-lg nums tracking-wider"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>

        {error && (
          <p id="login-error" role="alert" className="field-error text-center">
            {error}
          </p>
        )}

        <button type="submit" disabled={pending || phone.length < 10} className="btn btn-primary btn-block py-3.5">
          {pending ? 'در حال ارسال…' : 'دریافت کد تأیید'}
        </button>

        <p className="text-xs text-ink-subtle text-center leading-relaxed">
          با ورود، <a href="/p/terms" className="text-accent-2 hover:underline">قوانین و مقررات</a> و{' '}
          <a href="/p/privacy" className="text-accent-2 hover:underline">حریم خصوصی</a> ارکید را می‌پذیرید.
        </p>
      </form>
    )
  }

  return (
    <form
      className="card p-7 space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        submitCode()
      }}
    >
      <div className="text-center">
        <p className="text-sm text-ink-muted">
          کد تأیید به شماره <span className="nums text-ink">{maskPhone(phone)}</span> ارسال شد.
        </p>
        <button
          type="button"
          onClick={() => {
            setStep('phone')
            setCode('')
            setError(null)
          }}
          className="text-xs text-accent-2 hover:underline mt-1"
        >
          تغییر شماره
        </button>
      </div>

      <div>
        <label htmlFor="code" className="label text-center">
          کد تأیید
        </label>
        <input
          ref={codeRef}
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          // Lets the OS offer the code straight from the SMS.
          autoComplete="one-time-code"
          dir="ltr"
          required
          maxLength={6}
          value={code}
          onChange={(event) => {
            const digits = toLatinDigits(event.target.value).replace(/\D/g, '').slice(0, 6)
            setCode(digits)
            // Six digits is unambiguously complete — submitting automatically
            // saves a tap on the step people are most likely to abandon.
            if (digits.length === 6) {
              setError(null)
              startTransition(async () => {
                const result = await verifyOtpAction({ phone, code: digits })
                if (result.ok) {
                  router.push(next)
                  router.refresh()
                } else {
                  setError(result.error)
                  setCode('')
                }
              })
            }
          }}
          className="field text-center text-2xl nums tracking-[0.5em] ps-[0.5em]"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'code-error' : undefined}
        />
      </div>

      {error && (
        <p id="code-error" role="alert" className="field-error text-center">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending || code.length !== 6} className="btn btn-primary btn-block py-3.5">
        {pending ? 'در حال بررسی…' : 'ورود'}
      </button>

      <div className="text-center">
        {cooldown > 0 ? (
          <p className="text-sm text-ink-subtle nums">
            ارسال مجدد کد تا {toPersianDigits(cooldown)} ثانیه دیگر
          </p>
        ) : (
          <button
            type="button"
            onClick={submitPhone}
            disabled={pending}
            className="text-sm text-accent-2 hover:underline"
          >
            ارسال مجدد کد
          </button>
        )}
      </div>
    </form>
  )
}
