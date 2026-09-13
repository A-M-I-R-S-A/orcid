'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { adjustStockAction, updateStockAction } from '@/modules/catalog/admin-actions'
import { mediaUrl } from '@/lib/media-url'
import { toLatinDigits, toPersianDigits } from '@/lib/persian'
import { Badge, Table, TableWrap, Td, Th } from './ui'

interface InventoryItem {
  id: number
  productId: number
  productName: string
  sku: string
  stockQty: number
  lowStockThreshold: number
  isActive: boolean
  productArchived: boolean
  imagePath: string | null
}

function Row({ item }: { item: InventoryItem }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState('1')
  const [exact, setExact] = useState(String(item.stockQty))
  const [error, setError] = useState<string | null>(null)

  const delta = (direction: 1 | -1) => {
    const count = Number(toLatinDigits(amount).replace(/[^0-9]/g, ''))
    if (!Number.isInteger(count) || count <= 0) { setError('تعداد معتبر وارد کنید.'); return }
    setError(null)
    startTransition(async () => {
      const result = await adjustStockAction({ productId: item.productId, variantId: item.id, delta: direction * count })
      if (result.ok) { setExact(String(result.data.stockQty)); router.refresh() }
      else setError(result.error)
    })
  }

  const tone = item.stockQty === 0 ? 'negative' : item.stockQty <= item.lowStockThreshold ? 'pending' : 'positive'
  return (
    <tr className="hover:bg-surface-sunken/40">
      <Td><div className="flex items-center gap-3"><div className="h-12 w-10 shrink-0 overflow-hidden rounded-md bg-surface-sunken">{item.imagePath && <img src={mediaUrl(item.imagePath)} alt="" width={40} height={48} className="h-full w-full object-cover" />}</div><div className="min-w-0"><Link href={`/admin/products/${item.productId}`} className="block truncate font-medium text-accent-2 hover:underline">{item.productName}</Link><span className="nums block text-xs text-ink-subtle" dir="ltr">{item.sku}</span></div></div></Td>
      <Td><Badge tone={tone}>{toPersianDigits(item.stockQty)}</Badge>{(!item.isActive || item.productArchived) && <span className="ms-2 text-xs text-ink-subtle">غیرفعال</span>}</Td>
      <Td><div className="flex min-w-[210px] items-center gap-2"><button type="button" disabled={pending} onClick={() => delta(-1)} className="btn btn-ghost btn-sm" aria-label="کاهش موجودی">−</button><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" className="field nums w-16 py-1.5 text-center" aria-label="مقدار افزایش یا کاهش" /><button type="button" disabled={pending} onClick={() => delta(1)} className="btn btn-secondary btn-sm" aria-label="افزایش موجودی">+</button></div></Td>
      <Td><form className="flex min-w-[180px] items-center gap-2" onSubmit={(event) => { event.preventDefault(); const stockQty = Number(toLatinDigits(exact).replace(/[^0-9]/g, '')); startTransition(async () => { const result = await updateStockAction({ productId: item.productId, variantId: item.id, stockQty }); if (result.ok) router.refresh(); else setError(result.error) }) }}><input value={exact} onChange={(event) => setExact(event.target.value)} inputMode="numeric" className="field nums w-20 py-1.5 text-center" aria-label="موجودی دقیق" /><button disabled={pending} className="btn btn-ghost btn-sm">ثبت</button></form>{error && <p className="mt-1 max-w-[220px] text-xs text-danger">{error}</p>}</Td>
    </tr>
  )
}

export function InventoryManager({ items }: { items: InventoryItem[] }) {
  return <TableWrap><Table><thead><tr><Th>محصول / SKU</Th><Th>موجودی فعلی</Th><Th>افزایش یا کاهش</Th><Th>ثبت موجودی دقیق</Th></tr></thead><tbody>{items.map((item) => <Row key={item.id} item={item} />)}</tbody></Table></TableWrap>
}
