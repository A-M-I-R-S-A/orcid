'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import type { ProductDetail } from '@/modules/catalog/queries'
import {
  archiveProductAction,
  attachOptionAction,
  createProductAction,
  deleteProductImageAction,
  deleteOptionAction,
  deleteOptionDefinitionAction,
  deleteOptionValueAction,
  deleteProductPermanentlyAction,
  deleteVariantAction,
  saveOptionAction,
  saveOptionValueAction,
  saveVariantAction,
  setPrimaryImageAction,
  updateImageAltAction,
  updateOptionDefinitionAction,
  updateOptionNoteAction,
  updateProductAction,
  uploadProductImageAction,
} from '@/modules/catalog/admin-actions'
import { mediaUrl } from '@/lib/media-url'
import { ContentImageUpload } from '@/components/admin/content-image-upload'
import { formatAmountLatin } from '@/lib/money'
import { toLatinDigits, toPersianDigits } from '@/lib/persian'

export function ProductEditor({
  product,
  categories,
  optionLibrary,
}: {
  product: ProductDetail | null
  categories: { id: number; name: string }[]
  optionLibrary: { id: number; name: string; kind: 'size' | 'color' | 'other'; values: { id: number; value: string; swatchHex: string | null }[] }[]
}) {
  return (
    <div className="space-y-6">
      <BasicsPanel product={product} categories={categories} />

      {product && (
        <>
          <OptionsPanel product={product} optionLibrary={optionLibrary} />
          <VariantsPanel product={product} />
          <ImagesPanel product={product} />
          <DangerPanel product={product} />
        </>
      )}
    </div>
  )
}

function BasicsPanel({
  product,
  categories,
}: {
  product: ProductDetail | null
  categories: { id: number; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  return (
    <section className="card p-6">
      <h2 className="text-lg text-ink mb-5">اطلاعات پایه</h2>

      <form
        className="space-y-5"
        action={(formData) => {
          setMessage(null)

          const input = {
            name: String(formData.get('name') ?? ''),
            slug: String(formData.get('slug') ?? ''),
            shortDescription: String(formData.get('shortDescription') ?? ''),
            description: String(formData.get('description') ?? ''),
            primaryCategoryId: formData.get('primaryCategoryId')
              ? Number(formData.get('primaryCategoryId'))
              : null,
            isActive: formData.get('isActive') === 'on',
            isFeatured: formData.get('isFeatured') === 'on',
            isNewArrival: formData.get('isNewArrival') === 'on',
            isBestseller: formData.get('isBestseller') === 'on',
            seoTitle: String(formData.get('seoTitle') ?? ''),
            seoDescription: String(formData.get('seoDescription') ?? ''),
          }

          startTransition(async () => {
            if (product) {
              const result = await updateProductAction(product.id, input)
              if (result.ok) {
                setMessage({ tone: 'ok', text: 'ذخیره شد.' })
                router.refresh()
              } else {
                setMessage({ tone: 'error', text: result.error })
              }
              return
            }

            const result = await createProductAction(input)
            if (result.ok) {
              router.push(`/admin/products/${result.data.id}`)
            } else {
              setMessage({ tone: 'error', text: result.error })
            }
          })
        }}
      >
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="label">
              نام محصول
            </label>
            <input
              id="name"
              name="name"
              required
              defaultValue={product?.name ?? ''}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="slug" className="label">
              نشانی صفحه (slug)
            </label>
            <input
              id="slug"
              name="slug"
              defaultValue={product?.slug ?? ''}
              className="field"
              placeholder="خالی بگذارید تا از نام ساخته شود"
            />
            {product && (
              <p className="hint">
                با تغییر نشانی، آدرس قبلی به‌صورت خودکار به آدرس جدید هدایت می‌شود.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="primaryCategoryId" className="label">
              دسته‌بندی اصلی
            </label>
            <select
              id="primaryCategoryId"
              name="primaryCategoryId"
              defaultValue={product?.primaryCategoryId ?? ''}
              className="field"
            >
              <option value="">بدون دسته‌بندی</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="shortDescription" className="label">
              توضیح کوتاه
            </label>
            <textarea
              id="shortDescription"
              name="shortDescription"
              rows={2}
              maxLength={320}
              defaultValue={product?.shortDescription ?? ''}
              className="field resize-y"
            />
            <p className="hint">در کارت محصول و به‌عنوان توضیحات پیش‌فرض سئو استفاده می‌شود.</p>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="description" className="label">
              توضیحات کامل
            </label>
            <textarea
              id="description"
              name="description"
              rows={7}
              defaultValue={product?.description ?? ''}
              className="field resize-y"
            />
            <p className="hint">HTML امن و تگ &lt;style&gt; پشتیبانی می‌شود. کدهای اجرایی و CSS ناامن هنگام ذخیره حذف می‌شوند.</p>
            {product && <div className="mt-3"><ContentImageUpload kind="product" textareaId="description" /></div>}
          </div>
        </div>

        <fieldset className="pt-4 border-t border-line">
          <legend className="text-sm text-ink-muted mb-3">وضعیت و برچسب‌ها</legend>
          <div className="flex flex-wrap gap-5">
            <Checkbox name="isActive" label="فعال" defaultChecked={product?.isActive ?? true} />
            <Checkbox name="isFeatured" label="منتخب" defaultChecked={false} />
            <Checkbox name="isNewArrival" label="تازه رسیده" defaultChecked={false} />
            <Checkbox name="isBestseller" label="پرفروش" defaultChecked={false} />
          </div>
        </fieldset>

        <fieldset className="pt-4 border-t border-line">
          <legend className="text-sm text-ink-muted mb-3">سئو</legend>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="seoTitle" className="label">
                عنوان سئو
              </label>
              <input
                id="seoTitle"
                name="seoTitle"
                maxLength={190}
                defaultValue={product?.seoTitle ?? ''}
                className="field"
                placeholder="خالی بگذارید تا از نام محصول ساخته شود"
              />
            </div>
            <div>
              <label htmlFor="seoDescription" className="label">
                توضیحات سئو
              </label>
              <input
                id="seoDescription"
                name="seoDescription"
                maxLength={320}
                defaultValue={product?.seoDescription ?? ''}
                className="field"
                placeholder="خالی بگذارید تا از توضیح کوتاه ساخته شود"
              />
            </div>
          </div>
        </fieldset>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? 'در حال ذخیره…' : product ? 'ذخیره تغییرات' : 'ایجاد محصول'}
          </button>
          {message && (
            <p className={`text-sm ${message.tone === 'ok' ? 'text-success' : 'text-danger'}`}>
              {message.text}
            </p>
          )}
        </div>
      </form>
    </section>
  )
}

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string
  label: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-[var(--color-accent)] w-4 h-4"
      />
      {label}
    </label>
  )
}

function OptionsPanel({ product, optionLibrary }: { product: ProductDetail; optionLibrary: { id: number; name: string; kind: 'size' | 'color' | 'other'; values: { id: number; value: string; swatchHex: string | null }[] }[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="card p-6">
      <h2 className="text-lg text-ink mb-1">ویژگی‌ها</h2>
      <p className="text-sm text-ink-muted mb-5">
        ابتدا ویژگی‌ها (مثلاً سایز و رنگ) و مقادیر آن‌ها را تعریف کنید، سپس تنوع‌ها را بسازید.
      </p>

      <div className="space-y-5">
        {product.options.map((option) => (
          <div key={option.id} className="rounded-xl border border-line p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="font-medium text-ink">
                {option.name}
                <span className="text-xs text-ink-subtle font-normal ms-2">
                  {option.kind === 'color' ? 'رنگ' : option.kind === 'size' ? 'سایز' : 'سایر'}
                </span>
              </p>
              <button type="button" disabled={pending} className="text-xs text-danger hover:underline" onClick={() => startTransition(async () => {
                const result = await deleteOptionAction(product.id, option.id)
                if (result.ok) router.refresh(); else setError(result.error)
              })}>حذف ویژگی از محصول</button>
            </div>

            <form className="mb-3 grid gap-2 sm:grid-cols-[1fr_9rem_auto]" action={(formData) => startTransition(async () => {
              const result = await saveOptionAction(product.id, { id: option.id, name: String(formData.get('name') ?? ''), kind: String(formData.get('kind') ?? 'other') as 'size' | 'color' | 'other', sortOrder: product.options.indexOf(option) })
              if (result.ok) router.refresh(); else setError(result.error)
            })}>
              <input name="name" defaultValue={option.name} required className="field py-2 text-sm" />
              <select name="kind" defaultValue={option.kind} className="field py-2 text-sm"><option value="size">سایز</option><option value="color">رنگ</option><option value="other">سایر</option></select>
              <button className="btn btn-secondary btn-sm" disabled={pending}>ویرایش</button>
            </form>

            <form className="mb-4 flex gap-2" action={(formData) => startTransition(async () => {
              const result = await updateOptionNoteAction(product.id, option.id, String(formData.get('note') ?? ''))
              if (result.ok) router.refresh(); else setError(result.error)
            })}>
              <input name="note" defaultValue={option.note ?? ''} maxLength={500} placeholder="نوت اختصاصی این ویژگی برای این محصول" className="field py-2 text-sm" />
              <button className="btn btn-ghost btn-sm" disabled={pending}>ذخیره نوت</button>
            </form>

            <div className="flex flex-wrap gap-2 mb-3">
              {option.values.map((value) => (
                <form
                  key={value.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-line text-sm"
                  action={(formData) => startTransition(async () => {
                    const result = await saveOptionValueAction(product.id, option.id, { id: value.id, value: String(formData.get('value') ?? ''), swatchHex: option.kind === 'color' ? String(formData.get('swatchHex') ?? '') : null, sortOrder: option.values.indexOf(value) })
                    if (result.ok) router.refresh(); else setError(result.error)
                  })}
                >
                  {option.kind === 'color' && <input name="swatchHex" type="color" defaultValue={value.swatchHex ?? '#000000'} className="h-6 w-6 rounded border-0 bg-transparent p-0" aria-label="رنگ" />}
                  <input name="value" defaultValue={value.value} required className="w-24 bg-transparent outline-none" aria-label="مقدار ویژگی" />
                  <button className="text-accent-2" disabled={pending} aria-label={`ذخیره ${value.value}`}>✓</button>
                  <button type="button" className="text-danger" aria-label={`حذف ${value.value}`} onClick={() => startTransition(async () => {
                    const result = await deleteOptionValueAction(product.id, option.id, value.id)
                    if (result.ok) router.refresh(); else setError(result.error)
                  })}>×</button>
                </form>
              ))}
              {option.values.length === 0 && (
                <span className="text-sm text-ink-subtle">مقداری تعریف نشده است</span>
              )}
            </div>

            <form
              className="flex flex-wrap gap-2"
              action={(formData) => {
                setError(null)
                startTransition(async () => {
                  const result = await saveOptionValueAction(product.id, option.id, {
                    value: String(formData.get('value') ?? ''),
                    swatchHex:
                      option.kind === 'color' ? String(formData.get('swatchHex') ?? '') : null,
                    sortOrder: option.values.length,
                  })
                  if (result.ok) router.refresh()
                  else setError(result.error)
                })
              }}
            >
              <input
                name="value"
                required
                placeholder="مقدار جدید"
                className="field py-2 text-sm w-40"
              />
              {option.kind === 'color' && (
                <input
                  name="swatchHex"
                  type="color"
                  defaultValue="#000000"
                  className="w-11 h-10 rounded-lg border border-line cursor-pointer bg-transparent p-1"
                  aria-label="رنگ نمونه"
                />
              )}
              <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
                افزودن
              </button>
            </form>
          </div>
        ))}
      </div>

      {optionLibrary.length > 0 && (
        <details className="mt-5 border-t border-line pt-5">
          <summary className="cursor-pointer font-medium text-ink">مدیریت کتابخانه ویژگی‌های سراسری</summary>
          <p className="mt-2 text-xs leading-relaxed text-ink-subtle">ویرایش نام یا نوع روی تمام محصولات متصل اعمال می‌شود. حذف فقط وقتی ممکن است که ویژگی به هیچ محصولی متصل نباشد.</p>
          <div className="mt-3 space-y-2">
            {optionLibrary.map((definition, index) => (
              <form key={definition.id} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_9rem_auto_auto]" action={(formData) => startTransition(async () => {
                const result = await updateOptionDefinitionAction(product.id, definition.id, { name: String(formData.get('name') ?? ''), kind: String(formData.get('kind') ?? 'other') as 'size' | 'color' | 'other', sortOrder: index })
                if (result.ok) router.refresh(); else setError(result.error)
              })}>
                <input name="name" required defaultValue={definition.name} className="field py-2 text-sm" />
                <select name="kind" defaultValue={definition.kind} className="field py-2 text-sm"><option value="size">سایز</option><option value="color">رنگ</option><option value="other">سایر</option></select>
                <button className="btn btn-secondary btn-sm" disabled={pending}>ذخیره سراسری</button>
                <button type="button" className="btn btn-ghost btn-sm text-danger" disabled={pending} onClick={() => startTransition(async () => {
                  const result = await deleteOptionDefinitionAction(product.id, definition.id)
                  if (result.ok) router.refresh(); else setError(result.error)
                })}>حذف سراسری</button>
              </form>
            ))}
          </div>
        </details>
      )}

      {optionLibrary.some((definition) => !product.options.some((option) => option.definitionId === definition.id)) && (
        <form className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-line" action={(formData) => startTransition(async () => {
          const result = await attachOptionAction(product.id, Number(formData.get('definitionId')), product.options.length)
          if (result.ok) router.refresh(); else setError(result.error)
        })}>
          <select name="definitionId" required defaultValue="" className="field py-2 text-sm max-w-sm"><option value="" disabled>انتخاب از ویژگی‌های سراسری…</option>{optionLibrary.filter((definition) => !product.options.some((option) => option.definitionId === definition.id)).map((definition) => <option key={definition.id} value={definition.id}>{definition.name} ({definition.values.map((value) => value.value).join('، ') || 'بدون مقدار'})</option>)}</select>
          <button className="btn btn-secondary btn-sm" disabled={pending}>افزودن به محصول</button>
        </form>
      )}

      <form
        className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-line"
        action={(formData) => {
          setError(null)
          startTransition(async () => {
            const result = await saveOptionAction(product.id, {
              name: String(formData.get('name') ?? ''),
              kind: String(formData.get('kind') ?? 'other') as 'size' | 'color' | 'other',
              sortOrder: product.options.length,
            })
            if (result.ok) router.refresh()
            else setError(result.error)
          })
        }}
      >
        <input name="name" required placeholder="نام ویژگی جدید" className="field py-2 text-sm w-44" />
        <select name="kind" className="field py-2 text-sm w-32">
          <option value="size">سایز</option>
          <option value="color">رنگ</option>
          <option value="other">سایر</option>
        </select>
        <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
          افزودن ویژگی
        </button>
      </form>

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </section>
  )
}

function VariantsPanel({ product }: { product: ProductDetail }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null)
  const editing = product.variants.find((variant) => variant.id === editingId) ?? null
  const duplicating = product.variants.find((variant) => variant.id === duplicatingId) ?? null

  const label = (selection: Record<number, number>) =>
    product.options
      .map((option) => {
        const value = option.values.find((v) => v.id === selection[option.id])
        return value ? `${option.name}: ${value.value}` : null
      })
      .filter(Boolean)
      .join(' • ')

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg text-ink">تنوع‌ها</h2>
          <p className="text-sm text-ink-muted mt-1">
            قیمت و موجودی روی تنوع تعریف می‌شود، نه روی محصول.
          </p>
        </div>
        {product.options.length > 0 && (
          <button
            type="button"
            onClick={() => { setEditingId(null); setDuplicatingId(null); setAdding((v) => !v) }}
            className="btn btn-secondary btn-sm"
          >
            {adding ? 'انصراف' : 'تنوع جدید'}
          </button>
        )}
      </div>

      {product.options.length === 0 && (
        <p className="text-sm text-warning bg-warning-bg rounded-lg p-3">
          ابتدا حداقل یک ویژگی با مقادیر آن تعریف کنید.
        </p>
      )}

      {adding && <VariantForm product={product} onDone={() => setAdding(false)} />}
      {editing && <VariantForm key={editing.id} product={product} variant={editing} onDone={() => setEditingId(null)} />}
      {duplicating && <VariantForm key={`duplicate-${duplicating.id}`} product={product} variant={duplicating} duplicate onDone={() => setDuplicatingId(null)} />}

      {product.variants.length > 0 && (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr>
                <th className="text-start px-3 py-2 text-xs text-ink-muted bg-surface-sunken">ترکیب</th>
                <th className="text-start px-3 py-2 text-xs text-ink-muted bg-surface-sunken">SKU</th>
                <th className="text-start px-3 py-2 text-xs text-ink-muted bg-surface-sunken">قیمت</th>
                <th className="text-start px-3 py-2 text-xs text-ink-muted bg-surface-sunken">تخفیف</th>
                <th className="text-start px-3 py-2 text-xs text-ink-muted bg-surface-sunken">موجودی</th>
                <th className="text-start px-3 py-2 text-xs text-ink-muted bg-surface-sunken" />
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => (
                <tr key={variant.id} className="border-t border-line">
                  <td className="px-3 py-2.5">{label(variant.selection) || '—'}</td>
                  <td className="px-3 py-2.5 nums text-xs" dir="ltr">
                    {variant.sku}
                  </td>
                  <td className="px-3 py-2.5 nums">{toPersianDigits(formatAmountLatin(variant.price))}</td>
                  <td className="px-3 py-2.5 nums">
                    {variant.discountPrice
                      ? toPersianDigits(formatAmountLatin(variant.discountPrice))
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`badge ${
                        variant.stockQty === 0
                          ? 'badge-negative'
                          : variant.stockQty <= 3
                            ? 'badge-pending'
                            : 'badge-neutral'
                      }`}
                    >
                      {toPersianDigits(variant.stockQty)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => { setAdding(false); setDuplicatingId(null); setEditingId(variant.id) }}
                      disabled={pending}
                      className="me-3 text-xs text-accent-2 hover:underline"
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAdding(false); setEditingId(null); setDuplicatingId(variant.id) }}
                      disabled={pending}
                      className="me-3 text-xs text-accent-2 hover:underline"
                    >
                      دوبلیکیت
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await deleteVariantAction(product.id, variant.id)
                          if (!result.ok) setError(result.error)
                          router.refresh()
                        })
                      }
                      disabled={pending}
                      className="text-xs text-danger hover:underline"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </section>
  )
}

function VariantForm({
  product,
  variant,
  duplicate = false,
  onDone,
}: {
  product: ProductDetail
  variant?: ProductDetail['variants'][number]
  duplicate?: boolean
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Record<number, number>>(variant?.selection ?? {})
  const duplicateSku = (() => {
    if (!duplicate || !variant) return variant?.sku ?? ''
    const used = new Set(product.variants.map((item) => item.sku.toLocaleLowerCase('en-US')))
    let candidate = `${variant.sku}-COPY`
    let suffix = 2
    while (used.has(candidate.toLocaleLowerCase('en-US'))) candidate = `${variant.sku}-COPY-${suffix++}`
    return candidate
  })()

  return (
    <form
      className="rounded-xl border border-accent-3 p-4 space-y-4 bg-surface-sunken/40"
      action={(formData) => {
        setError(null)

        const missing = product.options.filter((o) => !selection[o.id])
        if (missing.length > 0) {
          setError(`مقدار ${missing.map((o) => o.name).join(' و ')} را انتخاب کنید.`)
          return
        }

        startTransition(async () => {
          const result = await saveVariantAction(product.id, {
            id: duplicate ? undefined : variant?.id,
            sku: String(formData.get('sku') ?? ''),
            price: Number(toLatinDigits(String(formData.get('price') ?? '0')).replace(/\D/g, '')),
            discountPrice: formData.get('discountPrice')
              ? Number(toLatinDigits(String(formData.get('discountPrice'))).replace(/\D/g, ''))
              : null,
            stockQty: Number(toLatinDigits(String(formData.get('stockQty') ?? '0')).replace(/\D/g, '')),
            lowStockThreshold: Number(toLatinDigits(String(formData.get('lowStockThreshold') ?? '3')).replace(/\D/g, '')),
            isActive: formData.get('isActive') === 'on',
            selection,
          })

          if (result.ok) {
            onDone()
            router.refresh()
          } else {
            setError(result.error)
          }
        })
      }}
    >
      <p className="text-sm font-medium text-ink">{duplicate ? `ساخت نسخه جدید از ${variant?.sku}` : variant ? `ویرایش ${variant.sku}` : 'تنوع جدید'}</p>
      <div className="flex flex-wrap gap-4">
        {product.options.map((option) => (
          <div key={option.id}>
            <label className="label text-xs">{option.name}</label>
            <select
              value={selection[option.id] ?? ''}
              onChange={(event) =>
                setSelection((s) => ({ ...s, [option.id]: Number(event.target.value) }))
              }
              className="field py-2 text-sm w-36"
            >
              <option value="">انتخاب…</option>
              {option.values.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.value}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor="v-sku" className="label text-xs">
            کد کالا (SKU)
          </label>
          <input id="v-sku" name="sku" required dir="ltr" defaultValue={duplicateSku} className="field py-2 text-sm w-36" />
        </div>
        <div>
          <label htmlFor="v-price" className="label text-xs">
            قیمت (تومان)
          </label>
          <input
            id="v-price"
            name="price"
            required
            inputMode="numeric"
            dir="ltr"
            className="field py-2 text-sm nums w-36"
            defaultValue={variant?.price ?? ''}
          />
        </div>
        <div>
          <label htmlFor="v-discount" className="label text-xs">
            قیمت با تخفیف
          </label>
          <input
            id="v-discount"
            name="discountPrice"
            inputMode="numeric"
            dir="ltr"
            className="field py-2 text-sm nums w-36"
            placeholder="اختیاری"
            defaultValue={variant?.discountPrice ?? ''}
          />
        </div>
        <div>
          <label htmlFor="v-stock" className="label text-xs">
            موجودی
          </label>
          <input
            id="v-stock"
            name="stockQty"
            required
            inputMode="numeric"
            dir="ltr"
            defaultValue={variant?.stockQty ?? 0}
            className="field py-2 text-sm nums w-28"
          />
        </div>
        <div>
          <label htmlFor="v-low-stock" className="label text-xs">هشدار کم‌موجودی</label>
          <input id="v-low-stock" name="lowStockThreshold" required inputMode="numeric" dir="ltr" defaultValue={variant?.lowStockThreshold ?? 3} className="field py-2 text-sm nums w-28" />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-ink-muted">
          <input name="isActive" type="checkbox" defaultChecked={variant?.isActive ?? true} />
          تنوع فعال باشد
        </label>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? 'در حال ذخیره…' : duplicate ? 'ساخت نسخه جدید' : variant ? 'ذخیره تغییرات' : 'ذخیره تنوع'}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost btn-sm">
          انصراف
        </button>
      </div>
    </form>
  )
}

function ImagesPanel({ product }: { product: ProductDetail }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="card p-6">
      <h2 className="text-lg text-ink mb-1">تصاویر</h2>
      <p className="text-sm text-ink-muted mb-5">
        متن جایگزین (alt) برای سئو و دسترس‌پذیری ضروری است.
      </p>

      {product.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {product.images.map((image) => (
            <div key={image.id} className="rounded-xl border border-line overflow-hidden">
              <div className="aspect-[4/5] bg-surface-sunken">
                <img
                  src={mediaUrl(image.path)}
                  alt={image.alt ?? ''}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-2.5 space-y-2">
                <input
                  defaultValue={image.alt ?? ''}
                  placeholder="متن جایگزین"
                  onBlur={(event) =>
                    startTransition(async () => {
                      await updateImageAltAction(product.id, image.id, event.target.value)
                      router.refresh()
                    })
                  }
                  className="field py-1.5 text-xs"
                />

                <div className="flex items-center justify-between gap-2">
                  {image.isPrimary ? (
                    <span className="badge badge-accent text-[10px]">اصلی</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          await setPrimaryImageAction(product.id, image.id)
                          router.refresh()
                        })
                      }
                      className="text-xs text-accent-2 hover:underline"
                    >
                      تصویر اصلی
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteProductImageAction(product.id, image.id)
                        if (!result.ok) setError(result.error)
                        router.refresh()
                      })
                    }
                    className="text-xs text-danger hover:underline"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        className="flex flex-wrap items-end gap-3 pt-5 border-t border-line"
        action={(formData) => {
          setError(null)
          const file = formData.get('file')
          if (file instanceof File && file.size > 8 * 1024 * 1024) {
            setError('حجم تصویر نباید بیشتر از ۸ مگابایت باشد.')
            return
          }
          formData.set('productId', String(product.id))

          startTransition(async () => {
            const result = await uploadProductImageAction(formData)
            if (result.ok) router.refresh()
            else setError(result.error)
          })
        }}
      >
        <div>
          <label htmlFor="image-file" className="label text-xs">
            تصویر جدید
          </label>
          <input
            id="image-file"
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="field py-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="image-alt" className="label text-xs">
            متن جایگزین
          </label>
          <input id="image-alt" name="alt" className="field py-2 text-sm" />
        </div>
        <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
          {pending ? 'در حال بارگذاری…' : 'بارگذاری'}
        </button>
      </form>

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </section>
  )
}

function DangerPanel({ product }: { product: ProductDetail }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="card p-6 border-danger/25">
      <h2 className="text-lg text-ink mb-1">بایگانی محصول</h2>
      <p className="text-sm text-ink-muted mb-4">
        محصول بایگانی‌شده از فروشگاه و نقشه سایت حذف می‌شود، اما سفارش‌های ثبت‌شده دست‌نخورده
        باقی می‌مانند.
      </p>

      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await archiveProductAction(product.id)
                router.push('/admin/products')
              })
            }
            className="btn btn-sm bg-danger text-white"
          >
            {pending ? '…' : 'بله، بایگانی کن'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost btn-sm">
            انصراف
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="btn btn-ghost btn-sm text-danger"
        >
          بایگانی محصول
        </button>
      )}

      <div className="mt-6 border-t border-danger/20 pt-5">
        <h3 className="text-sm font-medium text-danger">حذف کامل و غیرقابل بازگشت</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">تمام اطلاعات کاتالوگ و تصاویر این محصول حذف می‌شود. محصول دارای سابقه سفارش یا پرداخت بعدی قابل حذف کامل نیست.</p>
        {deleting ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending} className="btn btn-sm bg-danger text-white" onClick={() => startTransition(async () => {
              setError(null)
              const result = await deleteProductPermanentlyAction(product.id)
              if (result.ok) router.push('/admin/products')
              else { setError(result.error); setDeleting(false) }
            })}>{pending ? 'در حال حذف…' : 'تأیید حذف کامل'}</button>
            <button type="button" disabled={pending} className="btn btn-ghost btn-sm" onClick={() => setDeleting(false)}>انصراف</button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm mt-3 text-danger" onClick={() => setDeleting(true)}>حذف کامل محصول</button>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </section>
  )
}
