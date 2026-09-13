'use client'

import { SiteStyledText } from '@/components/site-content-provider'
import { useState, useTransition } from 'react'

import {
  createAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
} from '@/modules/account/actions'
import type { Address } from '@/modules/account/service'
import { toLatinDigits, toPersianDigits } from '@/lib/persian'
import { PROVINCES } from '@/lib/provinces'
import { useSiteText } from '@/components/site-content-provider'

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const [editing, setEditing] = useState<Address | 'new' | null>(null)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const t = useSiteText

  const remove = (id: number) => {
    setError(null)
    startTransition(async () => {
      const result = await deleteAddressAction({ id })
      if (!result.ok) setError(result.error)
      setConfirming(null)
    })
  }

  const makeDefault = (id: number) => {
    setError(null)
    startTransition(async () => {
      const result = await setDefaultAddressAction({ id })
      if (!result.ok) setError(result.error)
    })
  }

  if (editing) {
    return (
      <AddressForm
        address={editing === 'new' ? null : editing}
        onDone={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {addresses.map((address) => (
          <li key={address.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-ink">
                  {address.fullName}
                  {address.isDefault && <span className="badge badge-accent"><SiteStyledText contentKey="address.default">{t('address.default', 'پیش‌فرض')}</SiteStyledText></span>}
                </p>
                <p className="mt-2 leading-relaxed text-ink-muted">
                  {address.province}، {address.city}، {address.addressLine}
                </p>
                <p className="nums mt-2 text-sm text-ink-subtle">
                  <SiteStyledText contentKey="address.postalCode">{t('address.postalCode', 'کد پستی')}</SiteStyledText> {toPersianDigits(address.postalCode)} — {toPersianDigits(address.phone)}
                </p>
                {address.notes && (
                  <p className="mt-2 text-sm text-ink-subtle"><SiteStyledText contentKey="address.note">{t('address.note', 'یادداشت')}</SiteStyledText>: {address.notes}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={() => makeDefault(address.id)}
                    disabled={pending}
                    className="rounded-md px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-50"
                  >
                    <SiteStyledText contentKey="address.default">{t('address.default', 'پیش‌فرض')}</SiteStyledText>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(address)}
                  className="rounded-md px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                >
                  <SiteStyledText contentKey="common.edit">{t('common.edit', 'ویرایش')}</SiteStyledText>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(address.id)}
                  className="rounded-md px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-danger-bg hover:text-danger"
                >
                  <SiteStyledText contentKey="common.delete">{t('common.delete', 'حذف')}</SiteStyledText>
                </button>
              </div>
            </div>

            {confirming === address.id && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-danger-bg px-4 py-3">
                <p className="text-sm text-danger"><SiteStyledText contentKey="address.deleteConfirm">{t('address.deleteConfirm', 'این نشانی حذف شود؟')}</SiteStyledText></p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="btn btn-ghost btn-sm"
                  >
                    <SiteStyledText contentKey="common.cancel">{t('common.cancel', 'انصراف')}</SiteStyledText>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(address.id)}
                    disabled={pending}
                    className="btn btn-sm bg-danger text-white hover:opacity-90"
                  >
                    {pending ? t('common.deleting', 'در حال حذف…') : t('common.delete', 'حذف')}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <button type="button" onClick={() => setEditing('new')} className="btn btn-secondary">
        <span aria-hidden="true">+</span> <SiteStyledText contentKey="address.add">{t('address.add', 'افزودن نشانی')}</SiteStyledText>
      </button>
    </div>
  )
}

function AddressForm({ address, onDone }: { address: Address | null; onDone: () => void }) {
  const t = useSiteText
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const submit = (formData: FormData) => {
    setError(null)
    setFieldErrors({})

    const input = {
      id: address?.id,
      fullName: String(formData.get('fullName') ?? ''),
      phone: toLatinDigits(String(formData.get('phone') ?? '')),
      province: String(formData.get('province') ?? ''),
      city: String(formData.get('city') ?? ''),
      addressLine: String(formData.get('addressLine') ?? ''),
      postalCode: toLatinDigits(String(formData.get('postalCode') ?? '')),
      notes: String(formData.get('notes') ?? ''),
      isDefault: formData.get('isDefault') === 'on',
    }

    startTransition(async () => {
      const result = address
        ? await updateAddressAction(input)
        : await createAddressAction(input)

      if (result.ok) onDone()
      else {
        setError(result.error)
        setFieldErrors(result.fieldErrors ?? {})
      }
    })
  }

  return (
    <form action={submit} className="card space-y-5 p-6">
      <h2 className="text-lg text-ink">{address ? t('address.editTitle', 'ویرایش نشانی') : t('address.newTitle', 'نشانی جدید')}</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="a-name" className="label">
            <SiteStyledText contentKey="address.recipient">{t('address.recipient', 'نام گیرنده')}</SiteStyledText>
          </label>
          <input
            id="a-name"
            name="fullName"
            defaultValue={address?.fullName ?? ''}
            required
            className="field"
            aria-invalid={Boolean(fieldErrors.fullName) || undefined}
          />
          {fieldErrors.fullName && <p className="field-error">{fieldErrors.fullName}</p>}
        </div>

        <div>
          <label htmlFor="a-phone" className="label">
            <SiteStyledText contentKey="address.phone">{t('address.phone', 'شماره تماس گیرنده')}</SiteStyledText>
          </label>
          <input
            id="a-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            dir="ltr"
            defaultValue={address?.phone ?? ''}
            required
            className="field nums"
            aria-invalid={Boolean(fieldErrors.phone) || undefined}
          />
          {fieldErrors.phone && <p className="field-error">{fieldErrors.phone}</p>}
        </div>

        <div>
          <label htmlFor="a-province" className="label">
            <SiteStyledText contentKey="address.province">{t('address.province', 'استان')}</SiteStyledText>
          </label>
          <select
            id="a-province"
            name="province"
            defaultValue={address?.province ?? ''}
            required
            className="field"
            aria-invalid={Boolean(fieldErrors.province) || undefined}
          >
            <option value="" disabled>
              {t('checkout.select', 'انتخاب کنید')}
            </option>
            {PROVINCES.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
          {fieldErrors.province && <p className="field-error">{fieldErrors.province}</p>}
        </div>

        <div>
          <label htmlFor="a-city" className="label">
            <SiteStyledText contentKey="address.city">{t('address.city', 'شهر')}</SiteStyledText>
          </label>
          <input
            id="a-city"
            name="city"
            defaultValue={address?.city ?? ''}
            required
            className="field"
            aria-invalid={Boolean(fieldErrors.city) || undefined}
          />
          {fieldErrors.city && <p className="field-error">{fieldErrors.city}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="a-line" className="label">
          <SiteStyledText contentKey="address.full">{t('address.full', 'نشانی کامل')}</SiteStyledText>
        </label>
        <textarea
          id="a-line"
          name="addressLine"
          rows={3}
          defaultValue={address?.addressLine ?? ''}
          required
          className="field resize-none"
          aria-invalid={Boolean(fieldErrors.addressLine) || undefined}
        />
        {fieldErrors.addressLine && <p className="field-error">{fieldErrors.addressLine}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="a-postal" className="label">
            <SiteStyledText contentKey="address.postalCode">{t('address.postalCode', 'کد پستی')}</SiteStyledText>
          </label>
          <input
            id="a-postal"
            name="postalCode"
            inputMode="numeric"
            dir="ltr"
            maxLength={12}
            defaultValue={address?.postalCode ?? ''}
            required
            className="field nums"
            aria-invalid={Boolean(fieldErrors.postalCode) || undefined}
          />
          {fieldErrors.postalCode && <p className="field-error">{fieldErrors.postalCode}</p>}
        </div>

        <div>
          <label htmlFor="a-notes" className="label">
            <SiteStyledText contentKey="address.courierNote">{t('address.courierNote', 'یادداشت برای پیک')}</SiteStyledText> <span className="font-normal text-ink-subtle">(<SiteStyledText contentKey="common.optional">{t('common.optional', 'اختیاری')}</SiteStyledText>)</span>
          </label>
          <input
            id="a-notes"
            name="notes"
            defaultValue={address?.notes ?? ''}
            className="field"
            placeholder={t('address.notePlaceholder', 'مثلاً زنگ واحد ۳')}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={address?.isDefault ?? false}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        <SiteStyledText contentKey="address.makeDefault">{t('address.makeDefault', 'نشانی پیش‌فرض من باشد')}</SiteStyledText>
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? t('common.saving', 'در حال ذخیره…') : t('address.save', 'ذخیره نشانی')}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost">
          <SiteStyledText contentKey="common.cancel">{t('common.cancel', 'انصراف')}</SiteStyledText>
        </button>
      </div>
    </form>
  )
}
