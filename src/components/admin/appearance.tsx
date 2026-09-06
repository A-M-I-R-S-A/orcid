'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { resetThemeAction, saveThemeAction, saveTypographyAction } from '@/modules/admin/settings-actions'
import type { FontDefinition, TypographySettings } from '@/lib/typography'
import { contrastGrade, contrastRatio, isValidHex } from '@/lib/color'
import { toPersianDigits } from '@/lib/persian'

export function ThemeEditor({
  fields,
  current,
  defaults,
}: {
  fields: { key: string; label: string; hint: string }[]
  current: Record<string, string>
  defaults: Record<string, string>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<Record<string, string>>(current)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const checks = useMemo(() => {
    const text = values.textDeep ?? defaults.textDeep!
    const bg = values.background ?? defaults.background!
    const accent = values.accentPrimary ?? defaults.accentPrimary!
    const paper = values.paper ?? defaults.paper!

    const valid = (hex: string) => isValidHex(hex)

    return [
      {
        label: 'متن روی پس‌زمینه',
        ratio: valid(text) && valid(bg) ? contrastRatio(text, bg) : null,
      },
      {
        label: 'متن روی کارت',
        ratio: valid(text) && valid(paper) ? contrastRatio(text, paper) : null,
      },
      {
        label: 'متن دکمه روی رنگ اصلی',
        ratio: valid(accent) ? contrastRatio(accent, '#FFFFFF') : null,
      },
    ]
  }, [values, defaults])

  const dirty = fields.some((field) => values[field.key] !== current[field.key])

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg text-ink">رنگ‌بندی</h2>
          <p className="text-sm text-ink-muted mt-1">
            این هفت رنگ، پایه تمام رنگ‌های سایت هستند. بقیه رنگ‌ها از روی آن‌ها محاسبه می‌شوند.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              const result = await resetThemeAction()
              if (result.ok) {
                setValues({ ...defaults })
                setMessage({ tone: 'ok', text: 'رنگ‌بندی به حالت پیش‌فرض بازگشت.' })
                router.refresh()
              }
            })
          }
          disabled={pending}
          className="btn btn-ghost btn-sm"
        >
          بازگردانی پیش‌فرض
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {fields.map((field) => {
          const value = values[field.key] ?? ''
          const valid = isValidHex(value)

          return (
            <div key={field.key}>
              <label htmlFor={`color-${field.key}`} className="label">
                {field.label}
              </label>

              <div className="flex gap-2">
                <input
                  id={`color-${field.key}`}
                  type="color"
                  value={valid ? value : '#000000'}
                  onChange={(event) =>
                    setValues((v) => ({ ...v, [field.key]: event.target.value.toUpperCase() }))
                  }
                  className="w-12 h-11 rounded-lg border border-line cursor-pointer bg-transparent p-1"
                  aria-label={`انتخابگر رنگ ${field.label}`}
                />
                <input
                  type="text"
                  value={value}
                  onChange={(event) =>
                    setValues((v) => ({ ...v, [field.key]: event.target.value.toUpperCase() }))
                  }
                  dir="ltr"
                  maxLength={7}
                  className="field nums flex-1"
                  aria-invalid={!valid}
                />
              </div>

              <p className="hint">{field.hint}</p>
              {!valid && value && <p className="field-error">قالب صحیح: #RRGGBB</p>}
            </div>
          )
        })}
      </div>

      <div className="mt-7 pt-6 border-t border-line">
        <h3 className="text-sm text-ink-muted mb-3">بررسی خوانایی</h3>
        <ul className="grid sm:grid-cols-3 gap-3">
          {checks.map((check) => {
            const grade = check.ratio ? contrastGrade(check.ratio) : null
            const failing = grade === 'fail' || grade === 'AA-large'

            return (
              <li
                key={check.label}
                className={`rounded-xl p-3 text-sm ${
                  failing ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success'
                }`}
              >
                <p className="font-medium">{check.label}</p>
                <p className="nums text-xs mt-1">
                  {check.ratio ? `${toPersianDigits(check.ratio.toFixed(1))} : ۱` : '—'}
                  {grade && grade !== 'fail' && ` — ${grade}`}
                  {grade === 'fail' && ' — خوانایی ناکافی'}
                </p>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() =>
            startTransition(async () => {
              setMessage(null)
              const result = await saveThemeAction(values)
              setMessage(
                result.ok
                  ? { tone: 'ok', text: 'رنگ‌بندی ذخیره شد.' }
                  : { tone: 'error', text: result.error },
              )
              if (result.ok) router.refresh()
            })
          }
          className="btn btn-primary"
        >
          {pending ? 'در حال ذخیره…' : 'ذخیره رنگ‌بندی'}
        </button>

        {message && (
          <p className={`text-sm ${message.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  )
}

export function TypographyEditor({
  fonts,
  current,
}: {
  fonts: FontDefinition[]
  current: TypographySettings
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState({
    headingFont: current.headingFont,
    bodyFont: current.bodyFont,
    baseSize: String(current.baseSize),
    scale: current.scale as string,
  })
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const bodyFonts = fonts.filter((f) => f.bodyEligible)

  return (
    <section className="card p-6">
      <h2 className="text-lg text-ink mb-1">تایپوگرافی</h2>
      <p className="text-sm text-ink-muted mb-6">
        هر دو فونت روی سرور میزبانی می‌شوند؛ تغییر فونت درخواست اضافه‌ای به مرورگر تحمیل نمی‌کند.
      </p>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="headingFont" className="label">
            فونت عناوین
          </label>
          <select
            id="headingFont"
            value={values.headingFont}
            onChange={(event) => setValues((v) => ({ ...v, headingFont: event.target.value }))}
            className="field"
          >
            {fonts.map((font) => (
              <option key={font.key} value={font.key}>
                {font.label}
              </option>
            ))}
          </select>
          <p className="hint">{fonts.find((f) => f.key === values.headingFont)?.note}</p>
        </div>

        <div>
          <label htmlFor="bodyFont" className="label">
            فونت متن
          </label>
          <select
            id="bodyFont"
            value={values.bodyFont}
            onChange={(event) => setValues((v) => ({ ...v, bodyFont: event.target.value }))}
            className="field"
          >
            {bodyFonts.map((font) => (
              <option key={font.key} value={font.key}>
                {font.label}
              </option>
            ))}
          </select>
          <p className="hint">فونت‌های تک‌وزن و نمایشی برای متن اصلی در دسترس نیستند.</p>
        </div>

        <div>
          <label htmlFor="baseSize" className="label">
            اندازه پایه متن
          </label>
          <input
            id="baseSize"
            type="number"
            min={14}
            max={20}
            value={values.baseSize}
            onChange={(event) => setValues((v) => ({ ...v, baseSize: event.target.value }))}
            dir="ltr"
            className="field nums"
          />
          <p className="hint">بین ۱۴ تا ۲۰ پیکسل</p>
        </div>

        <div>
          <label htmlFor="scale" className="label">
            مقیاس عناوین
          </label>
          <select
            id="scale"
            value={values.scale}
            onChange={(event) => setValues((v) => ({ ...v, scale: event.target.value }))}
            className="field"
          >
            <option value="compact">فشرده</option>
            <option value="default">متعادل</option>
            <option value="spacious">بازتر</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null)
              const result = await saveTypographyAction(values)
              setMessage(
                result.ok
                  ? { tone: 'ok', text: 'تایپوگرافی ذخیره شد.' }
                  : { tone: 'error', text: result.error },
              )
              if (result.ok) router.refresh()
            })
          }
          className="btn btn-primary"
        >
          {pending ? 'در حال ذخیره…' : 'ذخیره تایپوگرافی'}
        </button>

        {message && (
          <p className={`text-sm ${message.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  )
}
