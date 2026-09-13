'use client'

import { SiteStyledText } from '@/components/site-content-provider'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { ResponsiveImage } from '@/components/media'
import { Price } from '@/components/ui'
import type { PaymentMethodInfo } from '@/modules/payments/registry'
import { submitGetLaterAction } from '@/modules/get-later/actions'
import { toPersianDigits } from '@/lib/persian'
import { calculateShipping, type ShippingConfig } from '@/lib/shipping'
import { useSiteText } from '@/components/site-content-provider'

interface Item {
  id: number
  productName: string
  productSlug: string
  variantLabel: string | null
  imagePath: string | null
  unitPrice: number
  quantity: number
  decision: 'undecided' | 'pay' | 'return'
}

interface Address {
  id: number
  fullName: string
  province: string
  city: string
  addressLine: string
  isDefault: boolean
}

export function GetLaterForm({
  cartId,
  items,
  addresses,
  methods,
  submitLabel,
  expired,
  shipping,
}: {
  cartId: number
  items: Item[]
  addresses: Address[]
  methods: PaymentMethodInfo[]
  submitLabel: string
  expired: boolean
  shipping: ShippingConfig
}) {
  const t = useSiteText
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [addressId, setAddressId] = useState(
    addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? 0,
  )
  const [method, setMethod] = useState(methods[0]?.key ?? '')
  const [decisions, setDecisions] = useState<Record<number, 'pay' | 'return' | undefined>>(
    Object.fromEntries(
      items.map((item) => [item.id, item.decision === 'undecided' ? undefined : item.decision]),
    ),
  )

  const summary = useMemo(() => {
    let pay = 0
    let returned = 0
    let decided = 0
    for (const item of items) {
      const decision = decisions[item.id]
      if (decision) decided += 1
      if (decision === 'pay') pay += item.unitPrice * item.quantity
      if (decision === 'return') returned += item.quantity
    }
    const shippingTotal = calculateShipping(pay, shipping)
    return { pay, shippingTotal, grandTotal: pay + shippingTotal, returned, decided }
  }, [decisions, items, shipping])

  const ready = summary.decided === items.length
  const canSubmit =
    ready &&
    confirmed &&
    !expired &&
    !pending &&
    (summary.pay === 0 || (addressId > 0 && Boolean(method)))

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        if (!canSubmit) return
        const customerNote = String(new FormData(event.currentTarget).get('customerNote') ?? '')

        startTransition(async () => {
          const result = await submitGetLaterAction({
            cartId,
            addressId,
            paymentMethod: method,
            customerNote,
            decisions: items.map((item) => ({ itemId: item.id, decision: decisions[item.id]! })),
          })
          if (!result.ok) {
            setError(result.error)
            return
          }
          if (result.data.orderId) {
            router.push(`/order/${result.data.orderId}/pay`)
          } else {
            router.push('/account/get-later?submitted=1')
            router.refresh()
          }
        })
      }}
    >
      <ul className="space-y-4" aria-label={t('later.itemsAria', 'کالاهای سبد پرداخت بعدی')}>
        {items.map((item) => (
          <li key={item.id} className="card overflow-hidden p-4 sm:p-5">
            <div className="flex gap-4">
              <div className="w-20 shrink-0 overflow-hidden rounded-lg bg-surface-sunken sm:w-24">
                <ResponsiveImage
                  path={item.imagePath}
                  alt={item.productName}
                  width={240}
                  height={300}
                  sizes="96px"
                  className="aspect-[4/5] h-auto w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium text-ink">{item.productName}</h2>
                {item.variantLabel && <p className="mt-1 text-sm text-ink-muted">{item.variantLabel}</p>}
                <p className="nums mt-2 text-sm text-ink-subtle">
                  {toPersianDigits(item.quantity)} × <Price amount={item.unitPrice} size="sm" />
                </p>
              </div>
              <Price amount={item.unitPrice * item.quantity} size="sm" className="shrink-0" />
            </div>

            <fieldset className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
              <legend className="sr-only"><SiteStyledText contentKey="later.decisionFor">{t('later.decisionFor', 'تصمیم برای')}</SiteStyledText> {item.productName}</legend>
              <Choice
                checked={decisions[item.id] === 'pay'}
                label={t('later.keep', 'نگه می‌دارم و پرداخت می‌کنم')}
                tone="pay"
                disabled={expired || pending}
                onChange={() => {
                  setDecisions((current) => ({ ...current, [item.id]: 'pay' }))
                  setConfirmed(false)
                }}
              />
              <Choice
                checked={decisions[item.id] === 'return'}
                label={t('later.return', 'بازمی‌گردانم')}
                tone="return"
                disabled={expired || pending}
                onChange={() => {
                  setDecisions((current) => ({ ...current, [item.id]: 'return' }))
                  setConfirmed(false)
                }}
              />
            </fieldset>
          </li>
        ))}
      </ul>

      {summary.pay > 0 && (
        <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="get-later-payment">
          <div>
            <h2 id="get-later-payment" className="text-lg text-ink"><SiteStyledText contentKey="later.paymentAddress">{t('later.paymentAddress', 'پرداخت و نشانی')}</SiteStyledText></h2>
            <p className="mt-1 text-sm text-ink-muted"><SiteStyledText contentKey="later.keptItems">{t('later.keptItems', 'برای کالاهایی که نگه می‌دارید.')}</SiteStyledText></p>
          </div>

          {addresses.length > 0 ? (
            <div>
              <label htmlFor="get-later-address" className="label"><SiteStyledText contentKey="later.savedAddress">{t('later.savedAddress', 'نشانی ثبت‌شده')}</SiteStyledText></label>
              <select id="get-later-address" className="field" value={addressId} onChange={(event) => setAddressId(Number(event.target.value))}>
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.fullName} — {address.province}، {address.city}، {address.addressLine}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="rounded-lg border border-warning/40 bg-warning-bg p-4 text-sm text-warning">
              <SiteStyledText contentKey="later.addressRequired">{t('later.addressRequired', 'پیش از نهایی‌کردن، از بخش «نشانی‌ها» یک نشانی ثبت کنید.')}</SiteStyledText>
            </p>
          )}

          <fieldset>
            <legend className="label mb-2"><SiteStyledText contentKey="checkout.paymentMethod">{t('checkout.paymentMethod', 'روش پرداخت')}</SiteStyledText></legend>
            {methods.length === 0 ? (
              <p className="rounded-lg border border-warning/40 bg-warning-bg p-4 text-sm text-warning">
                <SiteStyledText contentKey="later.noPayment">{t('later.noPayment', 'در حال حاضر روش پرداخت فعالی وجود ندارد. با پشتیبانی تماس بگیرید.')}</SiteStyledText>
              </p>
            ) : (
              <div className="space-y-2">
                {methods.map((paymentMethod) => (
                  <label key={paymentMethod.key} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-3 hover:border-accent-3">
                    <input type="radio" name="paymentMethod" value={paymentMethod.key} checked={method === paymentMethod.key} onChange={() => setMethod(paymentMethod.key)} className="mt-1 accent-[var(--color-accent)]" />
                    <span><span className="block text-sm text-ink">{paymentMethod.label}</span><span className="mt-0.5 block text-xs text-ink-muted">{paymentMethod.description}</span></span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div>
            <label htmlFor="get-later-note" className="label"><SiteStyledText contentKey="address.note">{t('address.note', 'یادداشت')}</SiteStyledText> (<SiteStyledText contentKey="common.optional">{t('common.optional', 'اختیاری')}</SiteStyledText>)</label>
            <textarea id="get-later-note" name="customerNote" maxLength={500} rows={3} className="field resize-y" />
          </div>
        </section>
      )}

      <aside className="card sticky bottom-3 z-10 border-accent-3 bg-surface/95 p-4 shadow-lg backdrop-blur sm:p-5" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-ink-muted"><SiteStyledText contentKey="later.finalAmount">{t('later.finalAmount', 'مبلغ نهایی قابل پرداخت')}</SiteStyledText></p>
            <p className="mt-1 text-xl text-ink"><Price amount={summary.grandTotal} /></p>
            {summary.pay > 0 && <p className="mt-1 text-xs text-ink-subtle"><SiteStyledText contentKey="later.shipping">{t('later.shipping', 'ارسال')}</SiteStyledText>: {summary.shippingTotal > 0 ? <Price amount={summary.shippingTotal} size="sm" /> : t('common.free', 'رایگان')}</p>}
            <p className="mt-1 text-xs text-ink-subtle">
              {toPersianDigits(summary.decided)} <SiteStyledText contentKey="later.of">{t('later.of', 'از')}</SiteStyledText> {toPersianDigits(items.length)} <SiteStyledText contentKey="later.decisionSuffix">{t('later.decisionSuffix', 'تصمیم ثبت شده')}</SiteStyledText>
              {summary.returned > 0 ? ` • ${toPersianDigits(summary.returned)} کالا برای بازگشت` : ''}
            </p>
          </div>
          <button type="submit" disabled={!canSubmit} className="btn btn-primary min-h-11 min-w-36 px-6">
            {pending ? t('later.submitting', 'در حال ثبت…') : submitLabel}
          </button>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 border-t border-line pt-4 text-sm text-ink-muted">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={expired || pending} className="mt-1 accent-[var(--color-accent)]" />
          <span><SiteStyledText contentKey="later.confirm">{t('later.confirm', 'انتخاب‌ها را بررسی کرده‌ام و می‌دانم پس از ارسال، قابل تغییر نیستند.')}</SiteStyledText></span>
        </label>
        {error && <p role="alert" className="field-error mt-3">{error}</p>}
      </aside>
    </form>
  )
}

function Choice({
  checked,
  label,
  tone,
  disabled,
  onChange,
}: {
  checked: boolean
  label: string
  tone: 'pay' | 'return'
  disabled: boolean
  onChange: () => void
}) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${checked ? tone === 'pay' ? 'border-success bg-success-bg text-success' : 'border-accent bg-surface-sunken text-ink' : 'border-line text-ink-muted hover:border-accent-3'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
      <input type="radio" checked={checked} disabled={disabled} onChange={onChange} className="accent-[var(--color-accent)]" />
      <span>{label}</span>
    </label>
  )
}
