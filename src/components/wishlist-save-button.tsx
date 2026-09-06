'use client'

import { WishlistButton } from './wishlist-button'

export function WishlistSaveButton({
  productId,
  productName,
}: {
  productId: number
  productName: string
}) {
  return (
    <div className="flex shrink-0 items-center rounded-full border border-line-strong px-1.5 transition-colors hover:border-accent">
      <WishlistButton
        productId={productId}
        productName={productName}
        className="!bg-transparent hover:!bg-transparent"
      />
    </div>
  )
}
