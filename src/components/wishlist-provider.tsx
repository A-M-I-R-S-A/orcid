'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

interface WishlistState {
  ready: boolean
  has: (productId: number) => boolean
  apply: (productId: number, saved: boolean) => void
}

const WishlistContext = createContext<WishlistState | null>(null)

export function WishlistProvider({
  signedIn,
  children,
}: {
  signedIn: boolean
  children: React.ReactNode
}) {
  const [ids, setIds] = useState<Set<number> | null>(null)

  useEffect(() => {
    if (!signedIn) {
      setIds(new Set())
      return
    }

    let cancelled = false

    fetch('/api/wishlist', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { ids: [] }))
      .then((data: { ids?: number[] }) => {
        if (!cancelled) setIds(new Set(data.ids ?? []))
      })
      .catch(() => {
        if (!cancelled) setIds(new Set())
      })

    return () => {
      cancelled = true
    }
  }, [signedIn])

  const apply = useCallback((productId: number, saved: boolean) => {
    setIds((current) => {
      const next = new Set(current ?? [])
      if (saved) next.add(productId)
      else next.delete(productId)
      return next
    })
  }, [])

  const value = useMemo<WishlistState>(
    () => ({
      ready: ids !== null,
      has: (productId: number) => ids?.has(productId) ?? false,
      apply,
    }),
    [ids, apply],
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist(): WishlistState {
  return (
    useContext(WishlistContext) ?? {
      ready: false,
      has: () => false,
      apply: () => {},
    }
  )
}
