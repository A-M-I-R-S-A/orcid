'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { placeOrderAction } from '@/modules/checkout/actions'
import type { PaymentMethodInfo } from '@/modules/payments/registry'
import { toLatinDigits } from '@/lib/persian'

/** The 31 provinces, for a select rather than a free-text field. */
const PROVINCES = [
  'آذربایجان شرقی', 'آذربایجان غربی', 'اردبیل', 'اصفهان', 'البرز', 'ایلام',
  'بوشهر', 'تهران', 'چهارمحال و بختیاری', 'خراسان جنوبی', 'خراسان رضوی',
  'خراسان شمالی', 'خوزستان', 'زنجان', 'سمنان', 'سیستان و بلوچستان', 'فارس',
  'قزوین', 'قم', 'کردستان', 'کرمان', 'کرمانشاه', 'کهگیلویه و بویراحمد',
  'گلستان', 'گیلان', 'لرستان', 'مازندران', 'مرکزی', 'هرمزگان', 'همدان', 'یزد',
]

export function CheckoutForm({
  methods,
  defaultValues,
}: {
  methods: PaymentMethodInfo[]
  defaultValues: {
    fullName: string
    phone: string
    province: string
    city: string
    addressLine: string
    postalCode: string
  }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [method, setMethod] = useState(methods[0]?.key ?? '')

  return (
    <form
      className="space-y-8"
      action={(formData) => {
        setError(null)
        setFieldErrors({})

        startTransition(async () => {
          const result = await placeOrderAction({
            fullName: String(formData.get('fullName') ?? ''),
            phone: String(formData.get('phone') ?? ''),
            province: String(formData.get('province') ?? ''),
            city: String(formData.get('city') ?? ''),
            addressLine: String(formData.get('addressLine') ?? ''),
            postalCode: String(formData.get('postalCode') ?? ''),
            customerNote: String(formData.get('customerNote') ?? ''),
            paymentMethod: method,
          })

          if (result.ok) {
            // Straight to the payment step — an order sitting unpaid because
            // the customer did not realise there was another step is the most
            // expensive abandonment there is.
            router.push(`/order/${result.data.orderId}/pay`)
          } else {
            setError(result.error)
            setFieldErrors(result.fieldErrors ?? {})
          }
        })
      }}
    >
      <fieldset className="card p-6 space-y-5">
        <legend className="text-lg text-ink px-2">اطلاعات گیرنده</legend>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field
            name="fullName"
            label="نام و نام خانوادگی"
            defaultValue={defaultValues.fullName}
            error={fieldErrors.fullName}
            autoComplete="name"
            required
          />
          <Field
            name="phone"
            label="شماره موبایل"
            defaultValue={defaultValues.phone}
            error={fieldErrors.phone}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            dir="ltr"
            className="nums"
            required
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="province" className="label">
              استان
            </label>
            <select
              id="province"
              name="province"
              defaultValue={defaultValues.province}
              required
              className="field"
              aria-invalid={Boolean(fieldErrors.province)}
            >
              <option value="">انتخاب کنید</option>
              {PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
            {fieldErrors.province && <p className="field-error">{fieldErrors.province}</p>}
          </div>

          <Field
            name="city"
            label="شهر"
            defaultValue={defaultValues.city}
            error={fieldErrors.city}
            autoComplete="address-level2"
            required
          />
        </div>

        <div>
          <label htmlFor="addressLine" className="label">
            نشانی کامل
          </label>
          <textarea
            id="addressLine"
            name="addressLine"
            rows={3}
            defaultValue={defaultValues.addressLine}
            required
            className="field resize-y"
            placeholder="خیابان، کوچه، پلاک، واحد"
            autoComplete="street-address"
            aria-invalid={Boolean(fieldErrors.addressLine)}
          />
          {fieldErrors.addressLine && <p className="field-error">{fieldErrors.addressLine}</p>}
        </div>

        <Field
          name="postalCode"
          label="کد پستی"
          defaultValue={defaultValues.postalCode}
          error={fieldErrors.postalCode}
          inputMode="numeric"
          dir="ltr"
          maxLength={12}
          className="nums"
          hint="کد پستی ۱۰ رقمی، بدون خط تیره"
          autoComplete="postal-code"
          required
        />

        <div>
          <label htmlFor="customerNote" className="label">
            توضیحات سفارش (اختیاری)
          </label>
          <textarea
            id="customerNote"
            name="customerNote"
            rows={2}
            className="field resize-y"
            placeholder="مثلاً ساعت مناسب تحویل"
          />
        </div>
      </fieldset>

      <fieldset className="card p-6">
        <legend className="text-lg text-ink px-2">روش پرداخت</legend>

        <div className="space-y-3 mt-2">
          {methods.map((option) => (
            <label
              key={option.key}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors duration-300 ${
                method === option.key
                  ? 'border-accent bg-surface-sunken'
                  : 'border-line hover:border-accent-3'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={option.key}
                checked={method === option.key}
                onChange={() => setMethod(option.key)}
                className="mt-1.5 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block font-medium text-ink">{option.label}</span>
                <span className="block text-sm text-ink-muted mt-1 leading-relaxed">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-md bg-danger-bg p-4 text-sm text-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending || !method} className="btn btn-primary btn-block py-4">
        {pending ? 'در حال ثبت سفارش…' : 'ثبت سفارش و ادامه'}
      </button>
    </form>
  )
}

function Field({
  name,
  label,
  error,
  hint,
  className,
  ...props
}: {
  name: string
  label: string
  error?: string
  hint?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={`field ${className ?? ''}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        // Persian digits are folded to Latin as the customer types, so a
        // Persian keyboard never produces a "not a valid number" rejection.
        onInput={
          props.inputMode === 'numeric'
            ? (event) => {
                const target = event.currentTarget
                const converted = toLatinDigits(target.value)
                if (converted !== target.value) target.value = converted
              }
            : undefined
        }
        {...props}
      />
      {error ? (
        <p id={`${name}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
