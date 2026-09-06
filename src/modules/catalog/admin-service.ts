import 'server-only'

import { and, eq, ne, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  categories,
  productImages,
  productOptionValues,
  productOptions,
  productVariants,
  products,
  slugRedirects,
  variantOptionValues,
} from '@/db/schema'
import * as audit from '@/lib/audit'
import { errors } from '@/lib/errors'
import { deleteImageSet, processUpload } from '@/lib/images'
import { normalizePersian } from '@/lib/persian'
import type { AdminPrincipal } from '@/lib/permissions'
import { slugify, uniqueSlug } from '@/lib/slug'

export async function rebuildSearchText(productId: number): Promise<void> {
  const [row] = await db
    .select({
      name: products.name,
      shortDescription: products.shortDescription,
      description: products.description,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.primaryCategoryId, categories.id))
    .where(eq(products.id, productId))
    .limit(1)

  if (!row) return

  const optionValues = await db
    .select({ value: productOptionValues.value })
    .from(productOptionValues)
    .innerJoin(productOptions, eq(productOptionValues.optionId, productOptions.id))
    .where(eq(productOptions.productId, productId))

  const parts = [
    row.name,
    row.shortDescription ?? '',
    (row.description ?? '').slice(0, 500),
    row.categoryName ?? '',
    ...optionValues.map((v) => v.value),
  ]

  const searchText = normalizePersian(parts.join(' '))

  await db.update(products).set({ searchText }).where(eq(products.id, productId))
}

export interface ProductInput {
  name: string
  slug?: string
  shortDescription?: string
  description?: string
  primaryCategoryId?: number | null
  isActive: boolean
  isFeatured: boolean
  isNewArrival: boolean
  isBestseller: boolean
  seoTitle?: string
  seoDescription?: string
}

export async function createProduct(
  admin: AdminPrincipal,
  input: ProductInput,
): Promise<number> {
  const slug = await uniqueSlug(input.slug || input.name, async (candidate) => {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, candidate))
      .limit(1)
    return Boolean(existing)
  })

  const [inserted] = await db.insert(products).values({
    name: input.name,
    slug,
    shortDescription: input.shortDescription || null,
    description: input.description || null,
    primaryCategoryId: input.primaryCategoryId ?? null,
    isActive: input.isActive,
    isFeatured: input.isFeatured,
    isNewArrival: input.isNewArrival,
    isBestseller: input.isBestseller,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    publishedAt: input.isActive ? new Date() : null,
  })

  const productId = (inserted as unknown as { insertId: number }).insertId
  await rebuildSearchText(productId)

  await audit.log({
    actor: admin,
    action: 'product.create',
    entityType: 'product',
    entityId: productId,
    summary: input.name,
  })

  return productId
}

export async function updateProduct(
  admin: AdminPrincipal,
  productId: number,
  input: ProductInput,
): Promise<void> {
  const [existing] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
  if (!existing) throw errors.notFound()

  let slug = existing.slug

  if (input.slug && slugify(input.slug) !== existing.slug) {
    slug = await uniqueSlug(input.slug, async (candidate) => {
      const [conflict] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.slug, candidate), ne(products.id, productId)))
        .limit(1)
      return Boolean(conflict)
    })

    await db
      .insert(slugRedirects)
      .values({ entityType: 'product', oldSlug: existing.slug, newSlug: slug })
      .onDuplicateKeyUpdate({ set: { newSlug: slug } })
  }

  await db
    .update(products)
    .set({
      name: input.name,
      slug,
      shortDescription: input.shortDescription || null,
      description: input.description || null,
      primaryCategoryId: input.primaryCategoryId ?? null,
      isActive: input.isActive,
      isFeatured: input.isFeatured,
      isNewArrival: input.isNewArrival,
      isBestseller: input.isBestseller,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      publishedAt: input.isActive ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
    })
    .where(eq(products.id, productId))

  await rebuildSearchText(productId)

  await audit.log({
    actor: admin,
    action: 'product.update',
    entityType: 'product',
    entityId: productId,
    summary: input.name,
    metadata: audit.diff(existing, { name: input.name, slug, isActive: input.isActive }, [
      'name',
      'slug',
      'isActive',
    ]),
  })
}

export async function archiveProduct(admin: AdminPrincipal, productId: number): Promise<void> {
  await db
    .update(products)
    .set({ isArchived: true, isActive: false })
    .where(eq(products.id, productId))

  await audit.log({
    actor: admin,
    action: 'product.archive',
    entityType: 'product',
    entityId: productId,
  })
}

export async function restoreProduct(admin: AdminPrincipal, productId: number): Promise<void> {
  await db.update(products).set({ isArchived: false }).where(eq(products.id, productId))

  await audit.log({
    actor: admin,
    action: 'product.update',
    entityType: 'product',
    entityId: productId,
    summary: 'بازگردانی از بایگانی',
  })
}

export interface VariantInput {
  id?: number
  sku: string
  price: number
  discountPrice?: number | null
  stockQty: number
  lowStockThreshold?: number
  isActive: boolean
  selection: Record<number, number>
}

export async function saveVariant(
  admin: AdminPrincipal,
  productId: number,
  input: VariantInput,
): Promise<number> {
  if (input.discountPrice != null && input.discountPrice >= input.price) {
    throw errors.validation('قیمت با تخفیف باید کمتر از قیمت اصلی باشد.')
  }
  if (input.stockQty < 0) {
    throw errors.validation('موجودی نمی‌تواند منفی باشد.')
  }

  return db.transaction(async (tx) => {
    let variantId = input.id
    let previous: typeof productVariants.$inferSelect | undefined

    if (variantId) {
      const [existing] = await tx
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
        .limit(1)

      if (!existing) throw errors.notFound()
      previous = existing

      await tx
        .update(productVariants)
        .set({
          sku: input.sku,
          price: input.price,
          discountPrice: input.discountPrice ?? null,
          stockQty: input.stockQty,
          lowStockThreshold: input.lowStockThreshold ?? 3,
          isActive: input.isActive,
        })
        .where(eq(productVariants.id, variantId))

      await tx.delete(variantOptionValues).where(eq(variantOptionValues.variantId, variantId))
    } else {
      const [inserted] = await tx.insert(productVariants).values({
        productId,
        sku: input.sku,
        price: input.price,
        discountPrice: input.discountPrice ?? null,
        stockQty: input.stockQty,
        lowStockThreshold: input.lowStockThreshold ?? 3,
        isActive: input.isActive,
      })
      variantId = (inserted as unknown as { insertId: number }).insertId
    }

    const rows = Object.entries(input.selection).map(([optionId, optionValueId]) => ({
      variantId: variantId!,
      optionId: Number(optionId),
      optionValueId: Number(optionValueId),
    }))

    if (rows.length > 0) {
      await tx.insert(variantOptionValues).values(rows)
    }

    if (previous) {
      if (previous.price !== input.price || previous.discountPrice !== input.discountPrice) {
        await audit.log({
          actor: admin,
          action: 'product.price_change',
          entityType: 'variant',
          entityId: variantId,
          metadata: {
            from: { price: previous.price, discount: previous.discountPrice },
            to: { price: input.price, discount: input.discountPrice },
          },
        })
      }
      if (previous.stockQty !== input.stockQty) {
        await audit.log({
          actor: admin,
          action: 'product.stock_change',
          entityType: 'variant',
          entityId: variantId,
          metadata: { from: previous.stockQty, to: input.stockQty, sku: input.sku },
        })
      }
    }

    return variantId!
  })
}

export async function deleteVariant(admin: AdminPrincipal, variantId: number): Promise<void> {
  const [used] = await db.execute(
    sql`SELECT COUNT(*) AS c FROM order_items WHERE variant_id = ${variantId}`,
  ) as unknown as [{ c: number }[], unknown]

  if (Number(used?.[0]?.c ?? 0) > 0) {
    await db.update(productVariants).set({ isActive: false }).where(eq(productVariants.id, variantId))
    throw errors.conflict(
      'این تنوع در سفارش‌های ثبت‌شده استفاده شده و قابل حذف نیست؛ به‌جای آن غیرفعال شد.',
    )
  }

  await db.delete(productVariants).where(eq(productVariants.id, variantId))

  await audit.log({
    actor: admin,
    action: 'product.update',
    entityType: 'variant',
    entityId: variantId,
    summary: 'حذف تنوع محصول',
  })
}

export async function saveOption(
  productId: number,
  input: { id?: number; name: string; kind: 'size' | 'color' | 'other'; sortOrder: number },
): Promise<number> {
  if (input.id) {
    await db
      .update(productOptions)
      .set({ name: input.name, kind: input.kind, sortOrder: input.sortOrder })
      .where(and(eq(productOptions.id, input.id), eq(productOptions.productId, productId)))
    return input.id
  }

  const [inserted] = await db.insert(productOptions).values({
    productId,
    name: input.name,
    kind: input.kind,
    sortOrder: input.sortOrder,
  })

  return (inserted as unknown as { insertId: number }).insertId
}

export async function saveOptionValue(
  optionId: number,
  input: { id?: number; value: string; swatchHex?: string | null; sortOrder: number },
): Promise<number> {
  if (input.id) {
    await db
      .update(productOptionValues)
      .set({ value: input.value, swatchHex: input.swatchHex ?? null, sortOrder: input.sortOrder })
      .where(eq(productOptionValues.id, input.id))
    return input.id
  }

  const [inserted] = await db.insert(productOptionValues).values({
    optionId,
    value: input.value,
    swatchHex: input.swatchHex ?? null,
    sortOrder: input.sortOrder,
  })

  return (inserted as unknown as { insertId: number }).insertId
}

export async function addProductImage(
  productId: number,
  file: File,
  alt: string,
): Promise<number> {
  const processed = await processUpload(file, { folder: 'products' })

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(productImages)
    .where(eq(productImages.productId, productId))

  const isFirst = Number(countRow?.count ?? 0) === 0

  const [inserted] = await db.insert(productImages).values({
    productId,
    path: processed.path,
    alt: alt || null,
    width: processed.width,
    height: processed.height,
    isPrimary: isFirst,
    sortOrder: Number(countRow?.count ?? 0),
  })

  return (inserted as unknown as { insertId: number }).insertId
}

export async function deleteProductImage(imageId: number): Promise<void> {
  const [image] = await db
    .select()
    .from(productImages)
    .where(eq(productImages.id, imageId))
    .limit(1)

  if (!image) return

  await db.delete(productImages).where(eq(productImages.id, imageId))
  await deleteImageSet(image.path)

  if (image.isPrimary) {
    const [next] = await db
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, image.productId))
      .orderBy(productImages.sortOrder)
      .limit(1)

    if (next) {
      await db.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, next.id))
    }
  }
}

export async function setPrimaryImage(productId: number, imageId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(productImages)
      .set({ isPrimary: false })
      .where(eq(productImages.productId, productId))

    await tx.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, imageId))
  })
}

export async function updateImageAlt(imageId: number, alt: string): Promise<void> {
  await db.update(productImages).set({ alt: alt || null }).where(eq(productImages.id, imageId))
}

export async function listProductsForAdmin(options: {
  search?: string
  status?: string
  page?: number
  limit?: number
}) {
  const page = Math.max(1, options.page ?? 1)
  const limit = options.limit ?? 30
  const conditions = []

  if (options.status === 'archived') conditions.push(eq(products.isArchived, true))
  else if (options.status === 'inactive')
    conditions.push(and(eq(products.isActive, false), eq(products.isArchived, false))!)
  else if (options.status === 'active')
    conditions.push(and(eq(products.isActive, true), eq(products.isArchived, false))!)
  else conditions.push(eq(products.isArchived, false))

  if (options.search) {
    const term = `%${options.search}%`
    conditions.push(sql`(${products.name} LIKE ${term} OR ${products.slug} LIKE ${term})`)
  }

  const where = and(...conditions)

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        isActive: products.isActive,
        isArchived: products.isArchived,
        isFeatured: products.isFeatured,
        createdAt: products.createdAt,
        categoryName: categories.name,
        variantCount: sql<number>`(SELECT COUNT(*) FROM product_variants WHERE product_id = ${products.id})`,
        totalStock: sql<number>`(SELECT COALESCE(SUM(stock_qty), 0) FROM product_variants WHERE product_id = ${products.id} AND is_active = 1)`,
        minPrice: sql<number>`(SELECT MIN(LEAST(price, COALESCE(discount_price, price))) FROM product_variants WHERE product_id = ${products.id} AND is_active = 1)`,
        imagePath: sql<string | null>`(SELECT path FROM product_images WHERE product_id = ${products.id} ORDER BY is_primary DESC, sort_order ASC LIMIT 1)`,
      })
      .from(products)
      .leftJoin(categories, eq(products.primaryCategoryId, categories.id))
      .where(where)
      .orderBy(sql`${products.createdAt} DESC`)
      .limit(limit)
      .offset((page - 1) * limit),

    db.select({ count: sql<number>`COUNT(*)` }).from(products).where(where),
  ])

  const total = Number(countRow?.count ?? 0)
  return { items: rows, total, page, pageCount: Math.max(1, Math.ceil(total / limit)) }
}
