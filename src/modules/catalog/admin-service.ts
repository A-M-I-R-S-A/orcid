import 'server-only'

import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  categories,
  optionDefinitions,
  optionDefinitionValues,
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
import { parseProductDescription, serializeProductDescription, type ProductDescriptionData } from '@/lib/product-description'
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

  const description = parseProductDescription(row.description)
  const parts = [
    row.name,
    row.shortDescription ?? '',
    description.title,
    description.intro,
    ...description.features.flatMap((feature) => [feature.title, feature.body]),
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
  description?: ProductDescriptionData
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
    description: input.description ? serializeProductDescription(input.description) : null,
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
      description: input.description ? serializeProductDescription(input.description) : null,
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
  if (!Number.isSafeInteger(input.price) || input.price <= 0 || !Number.isInteger(input.stockQty) || input.stockQty > 1_000_000_000) {
    throw errors.validation('قیمت و موجودی باید عدد صحیح معتبر باشند.')
  }
  if (input.discountPrice != null && (!Number.isSafeInteger(input.discountPrice) || input.discountPrice < 0)) {
    throw errors.validation('قیمت تخفیف معتبر نیست.')
  }
  if (!Number.isInteger(input.lowStockThreshold ?? 3) || (input.lowStockThreshold ?? 3) < 0) {
    throw errors.validation('آستانه کم‌موجودی معتبر نیست.')
  }

  return db.transaction(async (tx) => {
    const optionRows = await tx.select({ id: productOptions.id }).from(productOptions).where(eq(productOptions.productId, productId))
    const optionIds = optionRows.map((option) => option.id)
    const selectedEntries = Object.entries(input.selection).map(([optionId, valueId]) => ({ optionId: Number(optionId), valueId: Number(valueId) }))
    if (optionIds.length === 0 || selectedEntries.length !== optionIds.length || selectedEntries.some((entry) => !optionIds.includes(entry.optionId))) {
      throw errors.validation('برای تمام ویژگی‌های محصول یک مقدار معتبر انتخاب کنید.')
    }
    const selectedValues = await tx.select({ id: productOptionValues.id, optionId: productOptionValues.optionId })
      .from(productOptionValues).where(inArray(productOptionValues.id, selectedEntries.map((entry) => entry.valueId)))
    if (selectedValues.length !== selectedEntries.length || selectedEntries.some((entry) => !selectedValues.some((value) => value.id === entry.valueId && value.optionId === entry.optionId))) {
      throw errors.validation('ترکیب انتخاب‌شده برای این محصول معتبر نیست.')
    }

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
    const [option] = await db.select().from(productOptions).where(and(eq(productOptions.id, input.id), eq(productOptions.productId, productId))).limit(1)
    if (!option) throw errors.notFound()
    if (option.definitionId) {
      await db.transaction(async (tx) => {
        await tx.update(optionDefinitions).set({ name: input.name, kind: input.kind, sortOrder: input.sortOrder }).where(eq(optionDefinitions.id, option.definitionId!))
        await tx.update(productOptions).set({ name: input.name, kind: input.kind }).where(eq(productOptions.definitionId, option.definitionId!))
      })
    } else {
      await db.update(productOptions).set({ name: input.name, kind: input.kind, sortOrder: input.sortOrder }).where(eq(productOptions.id, input.id))
    }
    return input.id
  }

  const [existing] = await db.select({ id: optionDefinitions.id }).from(optionDefinitions).where(and(eq(optionDefinitions.name, input.name), eq(optionDefinitions.kind, input.kind))).limit(1)
  if (existing) return attachOption(productId, existing.id, input.sortOrder)
  const [created] = await db.insert(optionDefinitions).values({ name: input.name, kind: input.kind, sortOrder: input.sortOrder })
  return attachOption(productId, (created as unknown as { insertId: number }).insertId, input.sortOrder)
}

export async function deleteProductPermanently(admin: AdminPrincipal, productId: number): Promise<void> {
  const [product] = await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, productId)).limit(1)
  if (!product) throw errors.notFound('محصول پیدا نشد.')

  const [[orders], [getLater], images] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) AS c FROM order_items WHERE product_id = ${productId}`) as unknown as Promise<[{ c: number }[], unknown]>,
    db.execute(sql`SELECT COUNT(*) AS c FROM get_later_items WHERE product_id = ${productId}`) as unknown as Promise<[{ c: number }[], unknown]>,
    db.select({ path: productImages.path }).from(productImages).where(eq(productImages.productId, productId)),
  ])

  if (Number(orders?.[0]?.c ?? 0) > 0 || Number(getLater?.[0]?.c ?? 0) > 0) {
    throw errors.conflict('این محصول سابقه سفارش یا پرداخت بعدی دارد و برای حفظ سوابق قابل حذف کامل نیست؛ آن را بایگانی کنید.')
  }

  await db.delete(products).where(eq(products.id, productId))
  await Promise.allSettled(images.map((image) => deleteImageSet(image.path)))
  await audit.log({
    actor: admin,
    action: 'product.delete',
    entityType: 'product',
    entityId: productId,
    summary: product.name,
  })
}

export async function attachOption(productId: number, definitionId: number, sortOrder: number): Promise<number> {
  const [alreadyAttached] = await db.select({ id: productOptions.id }).from(productOptions).where(and(eq(productOptions.productId, productId), eq(productOptions.definitionId, definitionId))).limit(1)
  if (alreadyAttached) throw errors.conflict('این ویژگی قبلاً به محصول اضافه شده است.')
  const [definition] = await db.select().from(optionDefinitions).where(eq(optionDefinitions.id, definitionId)).limit(1)
  if (!definition) throw errors.notFound('ویژگی سراسری پیدا نشد.')
  const values = await db.select().from(optionDefinitionValues).where(eq(optionDefinitionValues.definitionId, definitionId)).orderBy(optionDefinitionValues.sortOrder)
  return db.transaction(async (tx) => {
    const [inserted] = await tx.insert(productOptions).values({ productId, definitionId, name: definition.name, kind: definition.kind, sortOrder })
    const optionId = (inserted as unknown as { insertId: number }).insertId
    if (values.length) await tx.insert(productOptionValues).values(values.map((value) => ({ optionId, definitionValueId: value.id, value: value.value, swatchHex: value.swatchHex, sortOrder: value.sortOrder })))
    return optionId
  })
}

export async function updateOptionDefinition(
  definitionId: number,
  input: { name: string; kind: 'size' | 'color' | 'other'; sortOrder: number },
): Promise<void> {
  const [definition] = await db.select({ id: optionDefinitions.id }).from(optionDefinitions).where(eq(optionDefinitions.id, definitionId)).limit(1)
  if (!definition) throw errors.notFound('ویژگی سراسری پیدا نشد.')
  await db.transaction(async (tx) => {
    await tx.update(optionDefinitions).set(input).where(eq(optionDefinitions.id, definitionId))
    await tx.update(productOptions).set({ name: input.name, kind: input.kind }).where(eq(productOptions.definitionId, definitionId))
  })
}

export async function deleteOptionDefinition(definitionId: number): Promise<void> {
  const [assignment] = await db.select({ id: productOptions.id }).from(productOptions).where(eq(productOptions.definitionId, definitionId)).limit(1)
  if (assignment) throw errors.conflict('این ویژگی به یک یا چند محصول متصل است؛ ابتدا آن را از محصولات جدا کنید.')
  await db.delete(optionDefinitions).where(eq(optionDefinitions.id, definitionId))
}

export async function updateOptionNote(productId: number, optionId: number, note: string): Promise<void> {
  await db.update(productOptions).set({ note: note.trim() || null }).where(and(eq(productOptions.id, optionId), eq(productOptions.productId, productId)))
}

export async function deleteOption(productId: number, optionId: number): Promise<void> {
  const [used] = await db.select({ id: variantOptionValues.variantId }).from(variantOptionValues).where(eq(variantOptionValues.optionId, optionId)).limit(1)
  if (used) throw errors.conflict('این ویژگی در تنوع‌های محصول استفاده شده است؛ ابتدا تنوع‌های وابسته را حذف کنید.')
  await db.delete(productOptions).where(and(eq(productOptions.id, optionId), eq(productOptions.productId, productId)))
}

export async function saveOptionValue(
  optionId: number,
  input: { id?: number; value: string; swatchHex?: string | null; sortOrder: number },
): Promise<number> {
  if (input.id) {
    const [current] = await db.select().from(productOptionValues).where(eq(productOptionValues.id, input.id)).limit(1)
    if (!current) throw errors.notFound()
    if (current.definitionValueId) {
      await db.transaction(async (tx) => {
        await tx.update(optionDefinitionValues).set({ value: input.value, swatchHex: input.swatchHex ?? null, sortOrder: input.sortOrder }).where(eq(optionDefinitionValues.id, current.definitionValueId!))
        await tx.update(productOptionValues).set({ value: input.value, swatchHex: input.swatchHex ?? null }).where(eq(productOptionValues.definitionValueId, current.definitionValueId!))
      })
    } else await db.update(productOptionValues).set({ value: input.value, swatchHex: input.swatchHex ?? null, sortOrder: input.sortOrder }).where(eq(productOptionValues.id, input.id))
    return input.id
  }

  const [option] = await db.select().from(productOptions).where(eq(productOptions.id, optionId)).limit(1)
  if (!option) throw errors.notFound()
  if (option.definitionId) {
    return db.transaction(async (tx) => {
      const [created] = await tx.insert(optionDefinitionValues).values({ definitionId: option.definitionId!, value: input.value, swatchHex: input.swatchHex ?? null, sortOrder: input.sortOrder })
      const definitionValueId = (created as unknown as { insertId: number }).insertId
      const assignments = await tx.select({ id: productOptions.id }).from(productOptions).where(eq(productOptions.definitionId, option.definitionId!))
      for (const assignment of assignments) {
        await tx.insert(productOptionValues).values({ optionId: assignment.id, definitionValueId, value: input.value, swatchHex: input.swatchHex ?? null, sortOrder: input.sortOrder })
          .onDuplicateKeyUpdate({ set: { definitionValueId, swatchHex: input.swatchHex ?? null, sortOrder: input.sortOrder } })
      }
      const [local] = await tx.select({ id: productOptionValues.id }).from(productOptionValues).where(and(eq(productOptionValues.optionId, optionId), eq(productOptionValues.definitionValueId, definitionValueId))).limit(1)
      return local!.id
    })
  }
  const [inserted] = await db.insert(productOptionValues).values({ optionId, definitionValueId: null, value: input.value, swatchHex: input.swatchHex ?? null, sortOrder: input.sortOrder })

  return (inserted as unknown as { insertId: number }).insertId
}

export async function deleteOptionValue(optionId: number, valueId: number): Promise<void> {
  const [value] = await db.select().from(productOptionValues).where(and(eq(productOptionValues.id, valueId), eq(productOptionValues.optionId, optionId))).limit(1)
  if (!value) throw errors.notFound()
  if (value.definitionValueId) {
    const linkedValues = await db.select({ id: productOptionValues.id }).from(productOptionValues).where(eq(productOptionValues.definitionValueId, value.definitionValueId))
    if (linkedValues.length) {
      const [used] = await db.select({ id: variantOptionValues.variantId }).from(variantOptionValues).where(inArray(variantOptionValues.optionValueId, linkedValues.map((item) => item.id))).limit(1)
      if (used) throw errors.conflict('این مقدار در تنوع‌های یک یا چند محصول استفاده شده است؛ ابتدا تنوع‌های وابسته را حذف کنید.')
    }
    await db.transaction(async (tx) => {
      await tx.delete(productOptionValues).where(eq(productOptionValues.definitionValueId, value.definitionValueId!))
      await tx.delete(optionDefinitionValues).where(eq(optionDefinitionValues.id, value.definitionValueId!))
    })
    return
  }
  const [used] = await db.select({ id: variantOptionValues.variantId }).from(variantOptionValues).where(eq(variantOptionValues.optionValueId, valueId)).limit(1)
  if (used) throw errors.conflict('این مقدار در تنوع محصول استفاده شده است؛ ابتدا تنوع وابسته را حذف کنید.')
  await db.delete(productOptionValues).where(eq(productOptionValues.id, valueId))
}

export async function addProductImage(
  productId: number,
  file: File,
  alt: string,
): Promise<{
  id: number
  path: string
  alt: string | null
  width: number
  height: number
  isPrimary: boolean
}> {
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

  return {
    id: (inserted as unknown as { insertId: number }).insertId,
    path: processed.path,
    alt: alt || null,
    width: processed.width,
    height: processed.height,
    isPrimary: isFirst,
  }
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

export async function listInventoryForAdmin(options: {
  search?: string
  status?: 'all' | 'low' | 'out'
  page?: number
  limit?: number
}) {
  const page = Math.max(1, options.page ?? 1)
  const limit = Math.min(100, Math.max(1, options.limit ?? 40))
  const conditions = []
  if (options.search?.trim()) {
    const term = `%${options.search.trim()}%`
    conditions.push(sql`(${products.name} LIKE ${term} OR ${productVariants.sku} LIKE ${term})`)
  }
  if (options.status === 'out') conditions.push(eq(productVariants.stockQty, 0))
  if (options.status === 'low') conditions.push(and(sql`${productVariants.stockQty} > 0`, sql`${productVariants.stockQty} <= ${productVariants.lowStockThreshold}`)!)
  const where = conditions.length ? and(...conditions) : undefined

  const [items, [countRow], [stats]] = await Promise.all([
    db.select({
      id: productVariants.id,
      productId: productVariants.productId,
      productName: products.name,
      productSlug: products.slug,
      sku: productVariants.sku,
      stockQty: productVariants.stockQty,
      lowStockThreshold: productVariants.lowStockThreshold,
      isActive: productVariants.isActive,
      productArchived: products.isArchived,
      imagePath: sql<string | null>`(SELECT path FROM product_images WHERE product_id = ${products.id} ORDER BY is_primary DESC, sort_order ASC LIMIT 1)`,
    }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id))
      .where(where).orderBy(asc(productVariants.stockQty), asc(products.name), asc(productVariants.sku))
      .limit(limit).offset((page - 1) * limit),
    db.select({ count: sql<number>`COUNT(*)` }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(where),
    db.select({
      totalUnits: sql<number>`COALESCE(SUM(${productVariants.stockQty}), 0)`,
      lowCount: sql<number>`SUM(CASE WHEN ${productVariants.stockQty} > 0 AND ${productVariants.stockQty} <= ${productVariants.lowStockThreshold} THEN 1 ELSE 0 END)`,
      outCount: sql<number>`SUM(CASE WHEN ${productVariants.stockQty} = 0 THEN 1 ELSE 0 END)`,
    }).from(productVariants),
  ])
  const total = Number(countRow?.count ?? 0)
  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / limit)),
    stats: { totalUnits: Number(stats?.totalUnits ?? 0), lowCount: Number(stats?.lowCount ?? 0), outCount: Number(stats?.outCount ?? 0) },
  }
}
