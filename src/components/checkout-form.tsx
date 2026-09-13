'use client'

import { SiteStyledText } from '@/components/site-content-provider'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { placeOrderAction } from '@/modules/checkout/actions'
import type { PaymentMethodInfo } from '@/modules/payments/registry'
import { toLatinDigits } from '@/lib/persian'
import { PROVINCES } from '@/lib/provinces'
import type { ShippingMethod } from '@/lib/shipping-config'
import { Price } from '@/components/ui'
import { useSiteText } from '@/components/site-content-provider'

export interface SavedAddress {
  id: number
  fullName: string
  phone: string
  province: string
  city: string
  addressLine: string
  postalCode: string
  isDefault: boolean
}

export function CheckoutForm({
  methods,
  shippingMethods,
  defaultValues,
  savedAddresses = [],
}: {
  methods: PaymentMethodInfo[]
  shippingMethods: ShippingMethod[]
  savedAddresses?: SavedAddress[]
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
  const savedLabel = useSiteText('checkout.savedAddresses', 'انتخاب از نشانی‌های ذخیره‌شده')
  const newAddressLabel = useSiteText('checkout.newAddress', 'نشانی جدید')
  const recipientLabel = useSiteText('checkout.recipient', 'اطلاعات گیرنده')
  const fullNameLabel = useSiteText('checkout.fullName', 'نام و نام خانوادگی')
  const mobileLabel = useSiteText('checkout.mobile', 'شماره موبایل')
  const provinceLabel = useSiteText('checkout.province', 'استان')
  const selectLabel = useSiteText('checkout.select', 'انتخاب کنید')
  const cityLabel = useSiteText('checkout.city', 'شهر')
  const addressLabel = useSiteText('checkout.address', 'نشانی کامل')
  const addressPlaceholder = useSiteText('checkout.addressPlaceholder', 'خیابان، کوچه، پلاک، واحد')
  const postalLabel = useSiteText('checkout.postalCode', 'کد پستی')
  const postalHint = useSiteText('checkout.postalHint', 'کد پستی ۱۰ رقمی، بدون خط تیره')
  const noteLabel = useSiteText('checkout.note', 'توضیحات سفارش (اختیاری)')
  const notePlaceholder = useSiteText('checkout.notePlaceholder', 'مثلاً ساعت مناسب تحویل')
  const shippingLabel = useSiteText('checkout.shippingMethod', 'روش ارسال')
  const paymentLabel = useSiteText('checkout.paymentMethod', 'روش پرداخت')
  const placingLabel = useSiteText('checkout.placing', 'در حال ثبت سفارش…')
  const placeLabel = useSiteText('checkout.place', 'ثبت سفارش و ادامه')
  const [method, setMethod] = useState(methods[0]?.key ?? '')
  const [shippingMethodId, setShippingMethodId] = useState(shippingMethods[0]?.id ?? 0)

  const [selectedId, setSelectedId] = useState<number | null>(
    savedAddresses.find((a) => a.isDefault)?.id ?? savedAddresses[0]?.id ?? null,
  )

  const selected = savedAddresses.find((a) => a.id === selectedId) ?? null
  const values = selected ?? defaultValues

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
            shippingMethodId,
            paymentMethod: method,
          })

          if (result.ok) {
            router.push(`/order/${result.data.orderId}/pay`)
          } else {
            setError(result.error)
            setFieldErrors(result.fieldErrors ?? {})
          }
        })
      }}
    >
      {savedAddresses.length > 0 && (
        <div className="card p-6">
          <p className="label mb-3"><SiteStyledText contentKey="checkout.savedAddresses">{savedLabel}</SiteStyledText></p>
          <div className="flex flex-wrap gap-2">
            {savedAddresses.map((address) => (
              <button
                key={address.id}
                type="button"
                onClick={() => setSelectedId(address.id)}
                aria-pressed={selectedId === address.id}
                className={`rounded-md border px-4 py-2.5 text-start text-sm transition-colors ${
                  selectedId === address.id
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-line hover:border-accent-3'
                }`}
              >
                <span className="block font-medium">
                  {address.province}، {address.city}
                </span>
                <span className="block truncate text-xs opacity-80">
                  {address.addressLine}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-pressed={selectedId === null}
              className={`rounded-md border px-4 py-2.5 text-sm transition-colors ${
                selectedId === null
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-line hover:border-accent-3'
              }`}
            >
              <SiteStyledText contentKey="checkout.newAddress">{newAddressLabel}</SiteStyledText>
            </button>
          </div>
        </div>
      )}

      <fieldset key={selectedId ?? 'new'} className="card p-6 space-y-5">
        <legend className="text-lg text-ink px-2"><SiteStyledText contentKey="checkout.recipient">{recipientLabel}</SiteStyledText></legend>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field
            name="fullName"
            label={fullNameLabel}
            defaultValue={values.fullName}
            error={fieldErrors.fullName}
            autoComplete="name"
            required
          />
          <Field
            name="phone"
            label={mobileLabel}
            defaultValue={values.phone}
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
              <SiteStyledText contentKey="checkout.province">{provinceLabel}</SiteStyledText>
            </label>
            <select
              id="province"
              name="province"
              defaultValue={values.province}
              required
              className="field"
              aria-invalid={Boolean(fieldErrors.province)}
            >
              <option value="">{selectLabel}</option>
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
            label={cityLabel}
            defaultValue={values.city}
            error={fieldErrors.city}
            autoComplete="address-level2"
            required
          />
        </div>

        <div>
          <label htmlFor="addressLine" className="label">
            <SiteStyledText contentKey="checkout.address">{addressLabel}</SiteStyledText>
          </label>
          <textarea
            id="addressLine"
            name="addressLine"
            rows={3}
            defaultValue={values.addressLine}
            required
            className="field resize-y"
            placeholder={addressPlaceholder}
            autoComplete="street-address"
            aria-invalid={Boolean(fieldErrors.addressLine)}
          />
          {fieldErrors.addressLine && <p className="field-error">{fieldErrors.addressLine}</p>}
        </div>

        <Field
          name="postalCode"
          label={postalLabel}
          defaultValue={values.postalCode}
          error={fieldErrors.postalCode}
          inputMode="numeric"
          dir="ltr"
          maxLength={12}
          className="nums"
          hint={postalHint}
          autoComplete="postal-code"
          required
        />

        <div>
          <label htmlFor="customerNote" className="label">
            <SiteStyledText contentKey="checkout.note">{noteLabel}</SiteStyledText>
          </label>
          <textarea
            id="customerNote"
            name="customerNote"
            rows={2}
            className="field resize-y"
            placeholder={notePlaceholder}
          />
        </div>
      </fieldset>

      <fieldset className="card p-6">
        <legend className="text-lg text-ink px-2"><SiteStyledText contentKey="checkout.shippingMethod">{shippingLabel}</SiteStyledText></legend>
        {shippingMethods.length === 1 ? (
          <ShippingMethodOption method={shippingMethods[0]!} selected />
        ) : (
          <div className="space-y-3 mt-2">
            {shippingMethods.map((option) => (
              <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${shippingMethodId === option.id ? 'border-accent bg-surface-sunken' : 'border-line hover:border-accent-3'}`}>
                <input type="radio" name="shippingMethod" value={option.id} checked={shippingMethodId === option.id} onChange={() => setShippingMethodId(option.id)} className="mt-1.5 accent-[var(--color-accent)]" />
                <ShippingMethodOption method={option} selected={false} />
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="card p-6">
        <legend className="text-lg text-ink px-2"><SiteStyledText contentKey="checkout.paymentMethod">{paymentLabel}</SiteStyledText></legend>

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
        {pending ? placingLabel : placeLabel}
      </button>
    </form>
  )
}

function ShippingMethodOption({ method, selected }: { method: ShippingMethod; selected: boolean }) {
  const cost = useSiteText('checkout.shippingCostPrefix', 'هزینه ارسال:')
  const free = useSiteText('common.free', 'رایگان')
  const eligible = useSiteText('checkout.freeEligible', 'برای خریدهای واجد شرایط رایگان')
  return <span className={selected ? 'block mt-2' : ''}><span className="block font-medium text-ink">{method.name}</span>{method.description && <span className="block text-sm text-ink-muted mt-1 leading-relaxed">{method.description}</span>}<span className="block text-sm text-ink-muted mt-1"><SiteStyledText contentKey="checkout.shippingCostPrefix">{cost}</SiteStyledText> {method.fee > 0 ? <Price amount={method.fee} size="sm" /> : free}{method.freeThreshold > 0 && ` (${eligible})`}</span></span>
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
