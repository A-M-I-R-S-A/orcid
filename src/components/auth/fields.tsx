'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { maskPhone, toLatinDigits, toPersianDigits } from '@/lib/persian'

export function PhoneField({
  value,
  onChange,
  invalid,
  disabled,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  disabled?: boolean
  autoFocus?: boolean
}) {
  const id = useId()

  return (
    <div>
      <label htmlFor={id} className="label">
        شماره موبایل
      </label>
      <input
        id={id}
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        dir="ltr"
        required
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(toLatinDigits(event.target.value).replace(/\D/g, '').slice(0, 11))}
        placeholder="09121234567"
        className="field nums text-center text-lg tracking-wider"
        aria-invalid={invalid || undefined}
      />
    </div>
  )
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  invalid,
  disabled,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  hint?: string
  invalid?: boolean
  disabled?: boolean
  autoFocus?: boolean
}) {
  const id = useId()
  const [shown, setShown] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={autoComplete === 'new-password' ? 'new-password' : 'password'}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={autoComplete === 'new-password' ? 8 : undefined}
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="field pe-12"
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="absolute inset-y-0 end-0 flex items-center px-3.5 text-ink-subtle transition-colors hover:text-accent-2"
          aria-label={shown ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
          aria-pressed={shown}
          tabIndex={-1}
        >
          {shown ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M3 3l18 18M10.6 10.7a2 2 0 002.8 2.8" />
              <path d="M7 7.4C4.9 8.7 3.4 10.6 2.5 12c1.7 2.9 5.2 6 9.5 6 1.6 0 3-.4 4.3-1.1M19.5 15.4c1-.9 1.8-2 2-3.4-1.7-2.9-5.2-6-9.5-6-.8 0-1.5.1-2.2.3" />
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M2.5 12C4.2 9.1 7.7 6 12 6s7.8 3.1 9.5 6c-1.7 2.9-5.2 6-9.5 6s-7.8-3.1-9.5-6z" />
              <circle cx="12" cy="12" r="2.6" />
            </svg>
          )}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
    </div>
  )
}

export function OtpField({
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  onComplete: (code: string) => void
  invalid?: boolean
  disabled?: boolean
}) {
  const id = useId()
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div>
      <label htmlFor={id} className="label text-center">
        کد تأیید
      </label>
      <input
        ref={ref}
        id={id}
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        dir="ltr"
        required
        maxLength={6}
        disabled={disabled}
        value={value}
        onChange={(event) => {
          const digits = toLatinDigits(event.target.value).replace(/\D/g, '').slice(0, 6)
          onChange(digits)
          if (digits.length === 6) onComplete(digits)
        }}
        className="field nums ps-[0.5em] text-center text-2xl tracking-[0.5em]"
        aria-invalid={invalid || undefined}
      />
    </div>
  )
}

export function SentToNotice({ phone, onEdit }: { phone: string; onEdit: () => void }) {
  return (
    <div className="rounded-md bg-surface-sunken/70 px-4 py-3 text-center">
      <p className="text-sm text-ink-muted">
        کد تأیید به شماره <span className="nums text-ink">{maskPhone(phone)}</span> پیامک شد.
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="mt-1 text-xs text-accent-2 transition-colors hover:text-accent"
      >
        تغییر شماره
      </button>
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-center text-sm text-danger">
      {message}
    </p>
  )
}

export function ResendControl({
  seconds,
  onResend,
  disabled,
}: {
  seconds: number
  onResend: () => void
  disabled?: boolean
}) {
  if (seconds > 0) {
    return (
      <p className="nums text-center text-sm text-ink-subtle">
        ارسال مجدد کد تا {toPersianDigits(seconds)} ثانیه دیگر
      </p>
    )
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={onResend}
        disabled={disabled}
        className="text-sm text-accent-2 transition-colors hover:text-accent disabled:opacity-50"
      >
        ارسال مجدد کد
      </button>
    </div>
  )
}

export function useCountdown(initial = 0) {
  const [seconds, setSeconds] = useState(initial)

  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  return [seconds, setSeconds] as const
}

export function SubmitButton({
  pending,
  disabled,
  children,
  pendingLabel,
}: {
  pending: boolean
  disabled?: boolean
  children: React.ReactNode
  pendingLabel: string
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="btn btn-primary btn-block py-3.5"
    >
      {pending ? pendingLabel : children}
    </button>
  )
}
