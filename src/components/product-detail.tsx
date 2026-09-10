'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import { SizeGuideDialog } from '@/components/size-guide-dialog'
import type { SizeGuide } from '@/lib/size-guide'

import { useRouter } from 'next/navigation'

import type { ProductDetail } from '@/modules/catalog/queries'
import { addToCartAction } from '@/modules/cart/actions'
import { addToGetLaterAction } from '@/modules/get-later/actions'
import { formatPrice } from '@/lib/money'
import { toPersianDigits } from '@/lib/persian'
import { ResponsiveImage } from './media'
import { Price } from './ui'
import { WishlistSaveButton } from './wishlist-save-button'

export function ProductPurchasePanel({
  product,
  sizeGuide,
  payLaterEnabled,
  signedIn,
}: {
  product: ProductDetail
  sizeGuide: SizeGuide | null
  payLaterEnabled: boolean
  signedIn: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const ctaRef = useRef<HTMLDivElement>(null)
  const [ctaVisible, setCtaVisible] = useState(true)

  useEffect(() => {
    const node = ctaRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => setCtaVisible(entry?.isIntersecting ?? true),
      { rootMargin: '-80px 0px 0px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const [selection, setSelection] = useState<Record<number, number>>(() => {
    const available = product.variants.find((v) => v.isActive && v.stockQty > 0)
    return available?.selection ?? product.variants[0]?.selection ?? {}
  })

  const activeVariant = useMemo(() => {
    return product.variants.find((variant) =>
      product.options.every((option) => variant.selection[option.id] === selection[option.id]),
    )
  }, [product.variants, product.options, selection])

  const isValueAvailable = (optionId: number, valueId: number) => {
    return product.variants.some((variant) => {
      if (!variant.isActive || variant.stockQty <= 0) return false
      if (variant.selection[optionId] !== valueId) return false

      return product.options
        .filter((o) => o.id !== optionId)
        .every((o) => selection[o.id] == null || variant.selection[o.id] === selection[o.id])
    })
  }

  const outOfStock = !activeVariant || activeVariant.stockQty <= 0
  const lowStock = activeVariant && activeVariant.stockQty > 0 && activeVariant.stockQty <= 3

  const handleAdd = () => {
    if (!activeVariant) return

    startTransition(async () => {
      const result = await addToCartAction({ variantId: activeVariant.id, quantity: 1 })

      if (result.ok) {
        setMessage({ tone: 'ok', text: 'به سبد خرید اضافه شد.' })
        router.refresh()
      } else {
        setMessage({ tone: 'error', text: result.error })
      }
    })
  }

  const handleAddLater = () => {
    if (!activeVariant) return
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/product/${product.slug}`)}`)
      return
    }
    startTransition(async () => {
      const result = await addToGetLaterAction({ variantId: activeVariant.id, quantity: 1 })
      if (result.ok) {
        setMessage({ tone: 'ok', text: 'به سبد پرداخت بعدی اضافه شد.' })
        router.refresh()
      } else setMessage({ tone: 'error', text: result.error })
    })
  }

  return (
    <div className="space-y-7">
      <div>
        {activeVariant ? (
          <Price
            amount={activeVariant.effectivePrice}
            original={
              activeVariant.discountPrice != null &&
              activeVariant.discountPrice < activeVariant.price
                ? activeVariant.price
                : null
            }
            size="lg"
          />
        ) : (
          <p className="text-ink-muted">ترکیب انتخاب‌شده موجود نیست</p>
        )}
      </div>

      {product.options.map((option) => (
        <fieldset key={option.id}>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <legend className="label">
              {option.name}
              {selection[option.id] != null && (
                <span className="text-ink-muted font-normal">
                  {' — '}
                  {option.values.find((v) => v.id === selection[option.id])?.value}
                </span>
              )}
            </legend>

            {option.kind === 'size' && sizeGuide && <SizeGuideDialog guide={sizeGuide} />}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {option.values.map((value) => {
              const selected = selection[option.id] === value.id
              const available = isValueAvailable(option.id, value.id)

              if (option.kind === 'color') {
                return (
                  <button
                    key={value.id}
                    type="button"
                    onClick={() => setSelection((s) => ({ ...s, [option.id]: value.id }))}
                    aria-pressed={selected}
                    title={value.value}
                    className={`relative w-11 h-11 rounded-full border-2 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      selected ? 'border-accent scale-110' : 'border-line hover:border-accent-3'
                    } ${!available ? 'opacity-40' : ''}`}
                    style={{ backgroundColor: value.swatchHex ?? 'var(--color-surface-sunken)' }}
                  >
                    <span className="sr-only">
                      {value.value}
                      {!available ? ' (ناموجود)' : ''}
                    </span>
                  </button>
                )
              }

              return (
                <button
                  key={value.id}
                  type="button"
                  onClick={() => setSelection((s) => ({ ...s, [option.id]: value.id }))}
                  aria-pressed={selected}
                  className={`min-w-[3.25rem] rounded-full border px-4 py-2.5 text-sm transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    selected
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-line hover:border-accent-3'
                  } ${!available ? 'opacity-40 line-through' : ''}`}
                >
                  {value.value}
                  {!available && <span className="sr-only"> (ناموجود)</span>}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}

      <div aria-live="polite" className="min-h-[1.5rem]">
        {outOfStock ? (
          <p className="text-sm text-danger">این ترکیب در حال حاضر موجود نیست.</p>
        ) : lowStock ? (
          <p className="text-sm text-warning nums">
            تنها {toPersianDigits(activeVariant!.stockQty)} عدد باقی مانده است.
          </p>
        ) : (
          <p className="text-sm text-success">موجود در انبار</p>
        )}
      </div>

      <div className="space-y-3" ref={ctaRef}>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock || pending}
            className="btn btn-primary flex-1 py-4 text-base"
          >
            {pending ? 'در حال افزودن…' : outOfStock ? 'ناموجود' : 'افزودن به سبد خرید'}
          </button>

          <WishlistSaveButton productId={product.id} productName={product.name} />
        </div>

        {payLaterEnabled && (
          <button type="button" onClick={handleAddLater} disabled={outOfStock || pending} className="btn btn-secondary w-full py-3.5">
            افزودن به سبد پرداخت بعدی
          </button>
        )}

        {message && (
          <p
            role="status"
            className={`text-sm text-center ${
              message.tone === 'ok' ? 'text-success' : 'text-danger'
            }`}
          >
            {message.text}
          </p>
        )}
      </div>

      {activeVariant && (
        <p className="text-xs text-ink-subtle">
          کد کالا: <span dir="ltr" className="nums">{activeVariant.sku}</span>
        </p>
      )}

      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-md transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden ${
          ctaVisible ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-hidden={ctaVisible}
      >
        <div className="container-page flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            {activeVariant ? (
              <>
                <p className="truncate text-xs text-ink-muted">{product.name}</p>
                <strong className="text-base text-ink nums">
                  {formatPrice(activeVariant.effectivePrice)}
                </strong>
              </>
            ) : (
              <p className="text-sm text-ink-muted">ترکیب انتخاب‌شده موجود نیست</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock || pending}
            tabIndex={ctaVisible ? -1 : 0}
            className="btn btn-primary shrink-0 px-6 py-3"
          >
            {pending ? '…' : outOfStock ? 'ناموجود' : 'افزودن'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProductGallery({
  images,
  productName,
}: {
  images: ProductDetail['images']
  productName: string
}) {
  const [active, setActive] = useState(0)
  const current = images[active] ?? images[0]

  if (!current) {
    return <div className="frame aspect-[4/5]" aria-hidden="true" />
  }

  return (
    <div className="space-y-3">
      <div className="frame">
        <ResponsiveImage
          path={current.path}
          alt={current.alt ?? productName}
          width={current.width}
          height={current.height}
          sizes="(min-width: 1024px) 45vw, 100vw"
          priority
          className="w-full h-auto object-cover aspect-[4/5]"
        />
      </div>

      {images.length > 1 && (
        <div
          className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1"
          role="tablist"
          aria-label="تصاویر محصول"
        >
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`تصویر ${toPersianDigits(i + 1)}`}
              onClick={() => setActive(i)}
              className={`shrink-0 w-[72px] overflow-hidden rounded-[3px] border-2 transition-colors duration-300 ${
                i === active ? 'border-accent' : 'border-transparent hover:border-accent-3'
              }`}
            >
              <ResponsiveImage
                path={image.path}
                alt=""
                width={image.width}
                height={image.height}
                sizes="72px"
                className="w-full h-auto object-cover aspect-[4/5]"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
