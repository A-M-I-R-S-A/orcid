import 'server-only'

import { cookies } from 'next/headers'
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  cartItems,
  carts,
  productImages,
  productOptionValues,
  productOptions,
  productVariants,
  products,
  variantOptionValues,
} from '@/db/schema'
import { generateToken } from '@/lib/crypto'
import { MESSAGES, errors } from '@/lib/errors'
import { effectivePrice } from '@/lib/money'
import { getShippingConfig } from '@/lib/shipping-config'
import { calculateShipping } from '@/lib/shipping'

const CART_COOKIE = 'orchid_cart'
const CART_TTL_DAYS = 30

export interface CartLine {
  itemId: number
  variantId: number
  productId: number
  productName: string
  productSlug: string
  variantLabel: string
  sku: string
  imagePath: string | null
  imageAlt: string | null
  unitPrice: number
  originalPrice: number
  quantity: number
  lineTotal: number
  stockQty: number
  exceedsStock: boolean
  isAvailable: boolean
}

export interface CartView {
  id: number | null
  lines: CartLine[]
  itemCount: number
  subtotal: number
  discountTotal: number
  shippingTotal: number
  grandTotal: number
  hasIssues: boolean
}

export const EMPTY_CART: CartView = {
  id: null,
  lines: [],
  itemCount: 0,
  subtotal: 0,
  discountTotal: 0,
  shippingTotal: 0,
  grandTotal: 0,
  hasIssues: false,
}

export async function resolveCart(
  userId: number | null,
  options: { create?: boolean } = {},
): Promise<{ id: number; token: string } | null> {
  const store = await cookies()
  const token = store.get(CART_COOKIE)?.value

  if (userId) {
    const [existing] = await db
      .select({ id: carts.id, token: carts.token })
      .from(carts)
      .where(eq(carts.userId, userId))
      .orderBy(desc(carts.updatedAt))
      .limit(1)

    if (existing) return existing
  }

  if (token) {
    const [existing] = await db
      .select({ id: carts.id, token: carts.token, userId: carts.userId })
      .from(carts)
      .where(eq(carts.token, token))
      .limit(1)

    if (existing) {
      if (userId && !existing.userId) {
        await db.update(carts).set({ userId }).where(eq(carts.id, existing.id))
      }
      return { id: existing.id, token: existing.token }
    }
  }

  if (!options.create) return null

  const newToken = generateToken(24)
  const [inserted] = await db.insert(carts).values({ userId, token: newToken })
  const id = (inserted as unknown as { insertId: number }).insertId

  store.set(CART_COOKIE, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CART_TTL_DAYS * 86_400,
  })

  return { id, token: newToken }
}

export async function mergeGuestCart(userId: number): Promise<void> {
  const store = await cookies()
  const token = store.get(CART_COOKIE)?.value
  if (!token) return

  const [guestCart] = await db
    .select({ id: carts.id, userId: carts.userId })
    .from(carts)
    .where(eq(carts.token, token))
    .limit(1)

  if (!guestCart || guestCart.userId === userId) return

  const [userCart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.userId, userId))
    .orderBy(desc(carts.updatedAt))
    .limit(1)

  if (!userCart) {
    await db.update(carts).set({ userId }).where(eq(carts.id, guestCart.id))
    return
  }

  const guestItems = await db.select().from(cartItems).where(eq(cartItems.cartId, guestCart.id))

  for (const item of guestItems) {
    const [variant] = await db
      .select({ stockQty: productVariants.stockQty })
      .from(productVariants)
      .where(eq(productVariants.id, item.variantId))
      .limit(1)

    const cap = variant?.stockQty ?? 0
    if (cap <= 0) continue

    await db
      .insert(cartItems)
      .values({ cartId: userCart.id, variantId: item.variantId, quantity: Math.min(item.quantity, cap) })
      .onDuplicateKeyUpdate({
        set: { quantity: sql`LEAST(${cartItems.quantity} + ${item.quantity}, ${cap})` },
      })
  }

  await db.delete(carts).where(eq(carts.id, guestCart.id))
}

export async function getCart(userId: number | null): Promise<CartView> {
  const cart = await resolveCart(userId)
  if (!cart) return EMPTY_CART

  const rows = await db
    .select({
      itemId: cartItems.id,
      quantity: cartItems.quantity,
      variantId: productVariants.id,
      sku: productVariants.sku,
      price: productVariants.price,
      discountPrice: productVariants.discountPrice,
      stockQty: productVariants.stockQty,
      variantActive: productVariants.isActive,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      productActive: products.isActive,
      productArchived: products.isArchived,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(asc(cartItems.createdAt))

  if (rows.length === 0) return { ...EMPTY_CART, id: cart.id }

  const productIds = [...new Set(rows.map((r) => r.productId))]
  const variantIds = rows.map((r) => r.variantId)

  const [images, labels] = await Promise.all([
    db
      .select({
        productId: productImages.productId,
        path: productImages.path,
        alt: productImages.alt,
        isPrimary: productImages.isPrimary,
        sortOrder: productImages.sortOrder,
      })
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder)),

    db
      .select({
        variantId: variantOptionValues.variantId,
        optionName: productOptions.name,
        value: productOptionValues.value,
      })
      .from(variantOptionValues)
      .innerJoin(productOptions, eq(variantOptionValues.optionId, productOptions.id))
      .innerJoin(
        productOptionValues,
        eq(variantOptionValues.optionValueId, productOptionValues.id),
      )
      .where(inArray(variantOptionValues.variantId, variantIds))
      .orderBy(asc(productOptions.sortOrder)),
  ])

  const imageBy = new Map<number, (typeof images)[number]>()
  for (const image of images) {
    if (!imageBy.has(image.productId)) imageBy.set(image.productId, image)
  }

  const labelBy = new Map<number, string[]>()
  for (const label of labels) {
    const list = labelBy.get(label.variantId) ?? []
    list.push(`${label.optionName}: ${label.value}`)
    labelBy.set(label.variantId, list)
  }

  let subtotal = 0
  let discountTotal = 0
  let itemCount = 0
  let hasIssues = false

  const lines: CartLine[] = rows.map((row) => {
    const unitPrice = effectivePrice(row.price, row.discountPrice)
    const lineTotal = unitPrice * row.quantity

    const isAvailable = row.variantActive && row.productActive && !row.productArchived
    const exceedsStock = row.quantity > row.stockQty

    if (!isAvailable || exceedsStock) hasIssues = true

    if (isAvailable && !exceedsStock) {
      subtotal += row.price * row.quantity
      discountTotal += (row.price - unitPrice) * row.quantity
      itemCount += row.quantity
    }

    const image = imageBy.get(row.productId)

    return {
      itemId: row.itemId,
      variantId: row.variantId,
      productId: row.productId,
      productName: row.productName,
      productSlug: row.productSlug,
      variantLabel: (labelBy.get(row.variantId) ?? []).join(' • '),
      sku: row.sku,
      imagePath: image?.path ?? null,
      imageAlt: image?.alt ?? row.productName,
      unitPrice,
      originalPrice: row.price,
      quantity: row.quantity,
      lineTotal,
      stockQty: row.stockQty,
      exceedsStock,
      isAvailable,
    }
  })

  const merchandiseTotal = subtotal - discountTotal
  const shippingTotal = calculateShipping(merchandiseTotal, await getShippingConfig())

  return {
    id: cart.id,
    lines,
    itemCount,
    subtotal,
    discountTotal,
    shippingTotal,
    grandTotal: merchandiseTotal + shippingTotal,
    hasIssues,
  }
}

export async function cartCount(userId: number | null): Promise<number> {
  const cart = await resolveCart(userId)
  if (!cart) return 0

  const [row] = await db
    .select({ count: sql<number>`COALESCE(SUM(${cartItems.quantity}), 0)` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cart.id))

  return Number(row?.count ?? 0)
}

export async function addItem(
  userId: number | null,
  variantId: number,
  quantity: number,
): Promise<void> {
  const [variant] = await db
    .select({
      id: productVariants.id,
      stockQty: productVariants.stockQty,
      isActive: productVariants.isActive,
      productActive: products.isActive,
      productArchived: products.isArchived,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(productVariants.id, variantId))
    .limit(1)

  if (!variant) throw errors.notFound(MESSAGES.variantUnavailable)
  if (!variant.isActive || !variant.productActive || variant.productArchived) {
    throw errors.validation(MESSAGES.productUnavailable)
  }
  if (variant.stockQty <= 0) throw errors.outOfStock(MESSAGES.productUnavailable)

  const cart = await resolveCart(userId, { create: true })
  if (!cart) throw errors.internal('Cart could not be created')

  await db
    .insert(cartItems)
    .values({ cartId: cart.id, variantId, quantity: Math.min(quantity, variant.stockQty) })
    .onDuplicateKeyUpdate({
      set: {
        quantity: sql`LEAST(${cartItems.quantity} + ${quantity}, ${variant.stockQty})`,
      },
    })

  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id))
}

export async function updateQuantity(
  userId: number | null,
  itemId: number,
  quantity: number,
): Promise<void> {
  const cart = await resolveCart(userId)
  if (!cart) throw errors.notFound()

  if (quantity <= 0) {
    await removeItem(userId, itemId)
    return
  }

  const [item] = await db
    .select({ id: cartItems.id, variantId: cartItems.variantId })
    .from(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
    .limit(1)

  if (!item) throw errors.notFound()

  const [variant] = await db
    .select({ stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(eq(productVariants.id, item.variantId))
    .limit(1)

  const capped = Math.min(quantity, variant?.stockQty ?? 0)
  if (capped <= 0) {
    await removeItem(userId, itemId)
    return
  }

  await db.update(cartItems).set({ quantity: capped }).where(eq(cartItems.id, itemId))
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id))
}

export async function removeItem(userId: number | null, itemId: number): Promise<void> {
  const cart = await resolveCart(userId)
  if (!cart) return

  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id))
}

export async function clearCart(cartId: number): Promise<void> {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId))
}

export async function pruneAbandoned(days = 60): Promise<void> {
  const cutoff = new Date(Date.now() - days * 86_400_000)
  await db.delete(carts).where(and(lt(carts.updatedAt, cutoff), sql`${carts.userId} IS NULL`))
}
