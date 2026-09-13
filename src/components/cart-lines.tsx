'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import type { CartLine } from '@/modules/cart/service'
import { removeCartItemAction, updateCartItemAction } from '@/modules/cart/actions'
import { toPersianDigits } from '@/lib/persian'
import { ResponsiveImage } from './media'
import { Price } from './ui'
import { useSiteText } from './site-content-provider'

export function CartLines({ lines }: { lines: CartLine[] }) {
  return (
    <ul className="space-y-6">
      {lines.map((line) => (
        <CartLineRow key={line.itemId} line={line} />
      ))}
    </ul>
  )
}

function CartLineRow({ line }: { line: CartLine }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const removePrefix = useSiteText('cart.removePrefix', 'حذف')
  const removeSuffix = useSiteText('cart.removeSuffix', 'از سبد خرید')
  const noLongerAvailable = useSiteText('cart.noLongerAvailable', 'این محصول دیگر در دسترس نیست.')
  const onlyPrefix = useSiteText('cart.onlyPrefix', 'تنها')
  const onlySuffix = useSiteText('cart.onlySuffix', 'عدد موجود است.')
  const decrease = useSiteText('cart.decrease', 'کاهش تعداد')
  const increase = useSiteText('cart.increase', 'افزایش تعداد')

  const update = (quantity: number) => {
    startTransition(async () => {
      await updateCartItemAction({ itemId: line.itemId, quantity })
      router.refresh()
    })
  }

  const remove = () => {
    startTransition(async () => {
      await removeCartItemAction(line.itemId)
      router.refresh()
    })
  }

  const unavailable = !line.isAvailable || line.exceedsStock

  return (
    <li
      className={`flex gap-4 pb-6 border-b border-line last:border-0 transition-opacity ${
        pending ? 'opacity-50' : ''
      }`}
    >
      <Link
        href={`/product/${encodeURIComponent(line.productSlug)}`}
        className="frame w-24 shrink-0 sm:w-28"
      >
        <ResponsiveImage
          path={line.imagePath}
          alt={line.imageAlt ?? line.productName}
          width={300}
          height={375}
          sizes="112px"
          className="w-full h-auto object-cover aspect-[4/5]"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/product/${encodeURIComponent(line.productSlug)}`}
              className="font-medium text-ink hover:text-accent-2 transition-colors line-clamp-2"
            >
              {line.productName}
            </Link>
            {line.variantLabel && (
              <p className="text-sm text-ink-muted mt-1">{line.variantLabel}</p>
            )}
          </div>

          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="shrink-0 p-2 -m-2 text-ink-subtle hover:text-danger transition-colors self-start"
            aria-label={`${removePrefix} ${line.productName} ${removeSuffix}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {unavailable && (
          <p className="mt-2 text-sm text-danger">
            {!line.isAvailable
              ? noLongerAvailable
              : `${onlyPrefix} ${toPersianDigits(line.stockQty)} ${onlySuffix}`}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="inline-flex items-center rounded-full border border-line">
            <button
              type="button"
              onClick={() => update(line.quantity - 1)}
              disabled={pending}
              className="w-9 h-9 flex items-center justify-center hover:bg-surface-sunken rounded-full transition-colors"
              aria-label={decrease}
            >
              −
            </button>
            <span className="w-10 text-center nums text-sm" aria-live="polite">
              {toPersianDigits(line.quantity)}
            </span>
            <button
              type="button"
              onClick={() => update(line.quantity + 1)}
              disabled={pending || line.quantity >= line.stockQty}
              className="w-9 h-9 flex items-center justify-center hover:bg-surface-sunken rounded-full transition-colors disabled:opacity-40"
              aria-label={increase}
            >
              +
            </button>
          </div>

          <Price
            amount={line.lineTotal}
            original={
              line.originalPrice > line.unitPrice ? line.originalPrice * line.quantity : null
            }
            size="sm"
          />
        </div>
      </div>
    </li>
  )
}
