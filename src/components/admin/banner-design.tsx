'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { saveBannerDesignAction } from '@/modules/admin/content-actions'
import {
  DEFAULT_BANNER,
  BANNER_ALIGNMENTS,
  BANNER_CTA_STYLES,
  BANNER_HEADERS,
  BANNER_HEIGHTS,
  BANNER_LABELS,
  BANNER_POSITIONS,
  BANNER_TONES,
  BANNER_VEILS,
  type BannerSettings,
} from '@/lib/banner'
import { toPersianDigits } from '@/lib/persian'

export function BannerDesignPanel({
  sectionId,
  settings,
  canOverlayHeader = false,
}: {
  sectionId: number
  settings: BannerSettings
  canOverlayHeader?: boolean
}) {
  const router = useRouter()
  const [value, setValue] = useState<BannerSettings>(settings)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const set = <K extends keyof BannerSettings>(key: K, next: BannerSettings[K]) => {
    setValue((current) => ({ ...current, [key]: next }))
    setMessage(null)
  }

  const save = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await saveBannerDesignAction({ id: sectionId, ...value })
      setMessage(
        result.ok ? { tone: 'ok', text: 'ذخیره شد.' } : { tone: 'error', text: result.error },
      )
      if (result.ok) router.refresh()
    })
  }

  return (
    <div className="space-y-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">طراحی تصویر</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
            جای متن، رنگ آن، پرده‌ای که روی عکس کشیده می‌شود و قاب‌بندی خود عکس. اگر متن روی
            تصویر خوانا نیست، رنگ متن را عوض کنید یا شدت پرده را بالا ببرید.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setValue(DEFAULT_BANNER)}
          className="text-xs text-ink-muted transition-colors hover:text-accent-2"
        >
          بازگشت به پیش‌فرض
        </button>
      </div>

      <Field label="متن بالای عنوان">
        <input
          value={value.eyebrow}
          onChange={(event) => set('eyebrow', event.target.value.slice(0, 80))}
          className="field"
          placeholder="مجموعه ارکید"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="جای افقی متن">
          <Segmented
            options={BANNER_ALIGNMENTS.map((v) => ({ value: v, label: BANNER_LABELS.align[v] }))}
            value={value.align}
            onChange={(v) => set('align', v)}
          />
        </Field>

        <Field label="جای عمودی متن">
          <Segmented
            options={BANNER_POSITIONS.map((v) => ({ value: v, label: BANNER_LABELS.position[v] }))}
            value={value.position}
            onChange={(v) => set('position', v)}
          />
        </Field>

        <Field label="رنگ متن">
          <Segmented
            options={BANNER_TONES.map((v) => ({ value: v, label: BANNER_LABELS.tone[v] }))}
            value={value.tone}
            onChange={(v) => set('tone', v)}
          />
        </Field>

        <Field label="ارتفاع">
          <Segmented
            options={BANNER_HEIGHTS.map((v) => ({ value: v, label: BANNER_LABELS.height[v] }))}
            value={value.height}
            onChange={(v) => set('height', v)}
          />
        </Field>

        <Field label="شکل دکمه">
          <Segmented
            options={BANNER_CTA_STYLES.map((v) => ({ value: v, label: BANNER_LABELS.ctaStyle[v] }))}
            value={value.ctaStyle}
            onChange={(v) => set('ctaStyle', v)}
          />
        </Field>

        {canOverlayHeader && (
          <Field label="هدر سایت">
            <Segmented
              options={BANNER_HEADERS.map((v) => ({ value: v, label: BANNER_LABELS.header[v] }))}
              value={value.header}
              onChange={(v) => set('header', v)}
            />
          </Field>
        )}

        <Field label="پرده روی عکس">
          <Segmented
            options={BANNER_VEILS.map((v) => ({ value: v, label: BANNER_LABELS.veil[v] }))}
            value={value.veil}
            onChange={(v) => set('veil', v)}
          />
        </Field>
      </div>

      <Field
        label={`شدت پرده — ${toPersianDigits(value.overlay)}٪`}
        hint="اگر تغییری نمی‌بینید، رنگ پرده را عوض کنید: پردهٔ روشن روی عکس روشن دیده نمی‌شود."
      >
        <Slider value={value.overlay} onChange={(v) => set('overlay', v)} />
      </Field>

      <Field
        label={`بزرگ‌نمایی — ${toPersianDigits(value.zoom)}٪`}
        hint="روی ۱۰۰٪ کل عکس در قاب جا می‌شود و جابه‌جایی زیر معمولاً اثری ندارد. برای جابه‌جا کردن تصویر، اول این را بالا ببرید."
      >
        <Slider value={value.zoom} min={100} max={200} onChange={(v) => set('zoom', v)} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={`جابه‌جایی افقی — ${toPersianDigits(value.focalX)}٪`}>
          <Slider value={value.focalX} onChange={(v) => set('focalX', v)} />
        </Field>

        <Field label={`جابه‌جایی عمودی — ${toPersianDigits(value.focalY)}٪`}>
          <Slider value={value.focalY} onChange={(v) => set('focalY', v)} />
        </Field>
      </div>

      <Field
        label={`محو کردن عکس — ${toPersianDigits(value.blur)}٪`}
        hint="عکس شلوغ را به زمینه‌ای برای متن تبدیل می‌کند."
      >
        <Slider value={value.blur} onChange={(v) => set('blur', v)} />
      </Field>

      <div className="flex items-center gap-4">
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary btn-sm">
          {pending ? 'در حال ذخیره…' : 'ذخیره طراحی'}
        </button>
        {message && (
          <p className={`text-sm ${message.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="label">{label}</p>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md bg-surface-sunken p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`flex-1 whitespace-nowrap rounded px-3 py-2 text-xs transition-colors ${
              active ? 'bg-accent font-medium text-on-accent' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      dir="ltr"
      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-sunken accent-[var(--color-accent)]"
    />
  )
}
