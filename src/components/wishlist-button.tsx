'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { toggleWishlistAction } from '@/modules/account/actions'
import { useWishlist } from './wishlist-provider'

export function WishlistButton({
  productId,
  productName,
  initialSaved = false,
  size = 'md',
  className,
}: {
  productId: number
  productName: string
  initialSaved?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const router = useRouter()
  const wishlist = useWishlist()
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [pending, startTransition] = useTransition()

  const saved = optimistic ?? (wishlist.ready ? wishlist.has(productId) : initialSaved)

  useEffect(() => {
    if (optimistic !== null && wishlist.ready && wishlist.has(productId) === optimistic) {
      setOptimistic(null)
    }
  }, [optimistic, wishlist, productId])

  const toggle = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const intent = !saved
    setOptimistic(intent)

    startTransition(async () => {
      const result = await toggleWishlistAction({ productId })

      if (!result.ok) {
        setOptimistic(null)
        return
      }

      if (result.data.requiresAuth) {
        setOptimistic(null)
        const next = encodeURIComponent(window.location.pathname + window.location.search)
        router.push(`/login?next=${next}`)
        return
      }

      wishlist.apply(productId, result.data.saved)
      setOptimistic(result.data.saved)
    })
  }

  const dimension = size === 'sm' ? 16 : 18

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `حذف ${productName} از علاقه‌مندی‌ها` : `افزودن ${productName} به علاقه‌مندی‌ها`}
      className={`flex items-center justify-center rounded-full backdrop-blur-sm transition-all duration-300 ${
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
      } ${
        saved
          ? 'bg-accent text-on-accent'
          : 'bg-surface/90 text-ink-muted hover:bg-surface hover:text-accent'
      } ${className ?? ''}`}
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={saved ? 'scale-110 transition-transform duration-300' : 'transition-transform duration-300'}
      >
        <path d="M12 20s-7-4.4-7-9.2A4 4 0 0112 8.6 4 4 0 0119 10.8C19 15.6 12 20 12 20z" />
      </svg>
    </button>
  )
}
