import 'server-only'

import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  categories,
  optionDefinitions,
  optionDefinitionValues,
  productCategories,
  productImages,
  productOptionValues,
  productOptions,
  productVariants,
  products,
  variantOptionValues,
} from '@/db/schema'
import { effectivePrice } from '@/lib/money'
import { escapeLike, tokenizeQuery } from '@/lib/persian'
import type { SearchParams } from '@/lib/validation'

export const PAGE_SIZE = 24

export interface ProductCard {
  id: number
  name: string
  slug: string
  shortDescription: string | null
  imagePath: string | null
  imageAlt: string | null
  imageWidth: number
  imageHeight: number
  minPrice: number
  maxPrice: number
  hasDiscount: boolean
  originalPrice: number | null
  inStock: boolean
  isNewArrival: boolean
  isBestseller: boolean
  ratingValue: number | null
  ratingCount: number
}

export interface ProductDetail {
  id: number
  name: string
  slug: string
  shortDescription: string | null
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  isActive: boolean
  isArchived: boolean
  ratingSum: number
  ratingCount: number
  createdAt: Date
  updatedAt: Date
  primaryCategoryId: number | null
  images: {
    id: number
    path: string
    alt: string | null
    width: number
    height: number
    isPrimary: boolean
  }[]
  options: {
    id: number
    definitionId: number | null
    name: string
    kind: 'size' | 'color' | 'other'
    note: string | null
    values: { id: number; definitionValueId: number | null; value: string; swatchHex: string | null }[]
  }[]
  variants: {
    id: number
    sku: string
    price: number
    discountPrice: number | null
    effectivePrice: number
    stockQty: number
    lowStockThreshold: number
    isActive: boolean
    imageId: number | null
    selection: Record<number, number>
  }[]
  category: { id: number; name: string; slug: string } | null
}

function variantSummary(productIds: number[]) {
  return db
    .select({
      productId: productVariants.productId,
      minPrice: sql<number>`MIN(LEAST(${productVariants.price}, COALESCE(${productVariants.discountPrice}, ${productVariants.price})))`,
      maxPrice: sql<number>`MAX(LEAST(${productVariants.price}, COALESCE(${productVariants.discountPrice}, ${productVariants.price})))`,
      maxOriginal: sql<number>`MAX(${productVariants.price})`,
      totalStock: sql<number>`SUM(${productVariants.stockQty})`,
      discounted: sql<number>`SUM(CASE WHEN ${productVariants.discountPrice} IS NOT NULL AND ${productVariants.discountPrice} < ${productVariants.price} THEN 1 ELSE 0 END)`,
    })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)))
    .groupBy(productVariants.productId)
}

function primaryImages(productIds: number[]) {
  return db
    .select({
      productId: productImages.productId,
      path: productImages.path,
      alt: productImages.alt,
      width: productImages.width,
      height: productImages.height,
      isPrimary: productImages.isPrimary,
      sortOrder: productImages.sortOrder,
    })
    .from(productImages)
    .where(inArray(productImages.productId, productIds))
    .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder))
}

async function hydrateCards(
  rows: {
    id: number
    name: string
    slug: string
    shortDescription: string | null
    isNewArrival: boolean
    isBestseller: boolean
    ratingSum: number
    ratingCount: number
  }[],
): Promise<ProductCard[]> {
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const [summaries, images] = await Promise.all([variantSummary(ids), primaryImages(ids)])

  const summaryBy = new Map(summaries.map((s) => [s.productId, s]))
  const imageBy = new Map<number, (typeof images)[number]>()
  for (const image of images) {
    if (!imageBy.has(image.productId)) imageBy.set(image.productId, image)
  }

  return rows.map((row) => {
    const summary = summaryBy.get(row.id)
    const image = imageBy.get(row.id)
    const hasDiscount = Number(summary?.discounted ?? 0) > 0

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortDescription: row.shortDescription,
      imagePath: image?.path ?? null,
      imageAlt: image?.alt ?? row.name,
      imageWidth: image?.width ?? 800,
      imageHeight: image?.height ?? 1000,
      minPrice: Number(summary?.minPrice ?? 0),
      maxPrice: Number(summary?.maxPrice ?? 0),
      hasDiscount,
      originalPrice: hasDiscount ? Number(summary?.maxOriginal ?? 0) : null,
      inStock: Number(summary?.totalStock ?? 0) > 0,
      isNewArrival: row.isNewArrival,
      isBestseller: row.isBestseller,
      ratingValue: row.ratingCount > 0 ? row.ratingSum / row.ratingCount : null,
      ratingCount: row.ratingCount,
    }
  })
}

export interface ListResult {
  items: ProductCard[]
  total: number
  page: number
  pageCount: number
}

export interface ListOptions extends Partial<SearchParams> {
  categoryId?: number
  featuredOnly?: boolean
  newOnly?: boolean
  bestsellerOnly?: boolean
  excludeId?: number
  limit?: number
}

export async function listProducts(options: ListOptions = {}): Promise<ListResult> {
  const page = Math.max(1, options.page ?? 1)
  const limit = options.limit ?? PAGE_SIZE
  const offset = (page - 1) * limit

  const conditions = [eq(products.isActive, true), eq(products.isArchived, false)]

  if (options.categoryId) {
    const inCategory = db
      .select({ productId: productCategories.productId })
      .from(productCategories)
      .where(eq(productCategories.categoryId, options.categoryId))

    conditions.push(
      or(
        eq(products.primaryCategoryId, options.categoryId),
        inArray(products.id, inCategory),
      )!,
    )
  }

  if (options.featuredOnly) conditions.push(eq(products.isFeatured, true))
  if (options.newOnly) conditions.push(eq(products.isNewArrival, true))
  if (options.bestsellerOnly) conditions.push(eq(products.isBestseller, true))
  if (options.excludeId) conditions.push(ne(products.id, options.excludeId))

  const variantConditions = []
  if (options.minPrice != null) {
    variantConditions.push(
      gte(
        sql`LEAST(${productVariants.price}, COALESCE(${productVariants.discountPrice}, ${productVariants.price}))`,
        options.minPrice,
      ),
    )
  }
  if (options.maxPrice != null) {
    variantConditions.push(
      lte(
        sql`LEAST(${productVariants.price}, COALESCE(${productVariants.discountPrice}, ${productVariants.price}))`,
        options.maxPrice,
      ),
    )
  }
  if (options.inStock) variantConditions.push(sql`${productVariants.stockQty} > 0`)

  if (options.color || options.size) {
    const valueMatch = []
    if (options.color) valueMatch.push(eq(productOptionValues.value, options.color))
    if (options.size) valueMatch.push(eq(productOptionValues.value, options.size))

    const matchingVariants = db
      .select({ variantId: variantOptionValues.variantId })
      .from(variantOptionValues)
      .innerJoin(
        productOptionValues,
        eq(variantOptionValues.optionValueId, productOptionValues.id),
      )
      .where(or(...valueMatch))

    variantConditions.push(inArray(productVariants.id, matchingVariants))
  }

  if (variantConditions.length > 0) {
    const matching = db
      .select({ productId: productVariants.productId })
      .from(productVariants)
      .where(and(eq(productVariants.isActive, true), ...variantConditions))

    conditions.push(inArray(products.id, matching))
  }

  const where = and(...conditions)

  const orderBy = (() => {
    switch (options.sort) {
      case 'price_asc':
        return [
          asc(
            sql`(SELECT MIN(LEAST(v.price, COALESCE(v.discount_price, v.price))) FROM product_variants v WHERE v.product_id = ${products.id} AND v.is_active = 1)`,
          ),
        ]
      case 'price_desc':
        return [
          desc(
            sql`(SELECT MIN(LEAST(v.price, COALESCE(v.discount_price, v.price))) FROM product_variants v WHERE v.product_id = ${products.id} AND v.is_active = 1)`,
          ),
        ]
      case 'popular':
        return [desc(products.salesCount), desc(products.createdAt)]
      default:
        return [desc(products.createdAt)]
    }
  })()

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        shortDescription: products.shortDescription,
        isNewArrival: products.isNewArrival,
        isBestseller: products.isBestseller,
        ratingSum: products.ratingSum,
        ratingCount: products.ratingCount,
      })
      .from(products)
      .where(where)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(products).where(where),
  ])

  const total = Number(countRow?.count ?? 0)

  return {
    items: await hydrateCards(rows),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function listProductsByIds(ids: number[]): Promise<ProductCard[]> {
  if (ids.length === 0) return []

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      shortDescription: products.shortDescription,
      isNewArrival: products.isNewArrival,
      isBestseller: products.isBestseller,
      ratingSum: products.ratingSum,
      ratingCount: products.ratingCount,
    })
    .from(products)
    .where(
      and(
        inArray(products.id, ids),
        eq(products.isActive, true),
        eq(products.isArchived, false),
      ),
    )

  const cards = await hydrateCards(rows)
  const position = new Map(ids.map((id, index) => [id, index]))

  return cards.sort(
    (a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
  )
}

export async function searchProducts(
  query: string,
  options: ListOptions = {},
): Promise<ListResult> {
  const { normalized, indexTokens, shortTokens } = tokenizeQuery(query)

  if (!normalized) {
    return { items: [], total: 0, page: 1, pageCount: 1 }
  }

  const page = Math.max(1, options.page ?? 1)
  const limit = options.limit ?? PAGE_SIZE
  const offset = (page - 1) * limit

  const conditions = [eq(products.isActive, true), eq(products.isArchived, false)]

  const matchers = []

  if (indexTokens.length > 0) {
    const booleanQuery = indexTokens.map((t) => `+${t}*`).join(' ')
    matchers.push(
      sql`MATCH(${products.searchText}) AGAINST(${booleanQuery} IN BOOLEAN MODE)`,
    )
  }

  for (const token of shortTokens) {
    matchers.push(sql`${products.searchText} LIKE ${'%' + escapeLike(token) + '%'}`)
  }
  matchers.push(sql`${products.searchText} LIKE ${'%' + escapeLike(normalized) + '%'}`)

  conditions.push(or(...matchers)!)

  if (options.inStock) {
    const inStockProducts = db
      .select({ productId: productVariants.productId })
      .from(productVariants)
      .where(and(eq(productVariants.isActive, true), sql`${productVariants.stockQty} > 0`))
    conditions.push(inArray(products.id, inStockProducts))
  }

  const where = and(...conditions)

  const relevance = sql<number>`
    (CASE WHEN ${products.name} = ${normalized} THEN 100 ELSE 0 END) +
    (CASE WHEN ${products.searchText} LIKE ${normalized + '%'} THEN 50 ELSE 0 END) +
    (CASE WHEN ${products.searchText} LIKE ${'%' + escapeLike(normalized) + '%'} THEN 25 ELSE 0 END) +
    ${products.salesCount} * 0.01
  `

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        shortDescription: products.shortDescription,
        isNewArrival: products.isNewArrival,
        isBestseller: products.isBestseller,
        ratingSum: products.ratingSum,
        ratingCount: products.ratingCount,
      })
      .from(products)
      .where(where)
      .orderBy(desc(relevance), desc(products.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(products).where(where),
  ])

  const total = Number(countRow?.count ?? 0)

  return {
    items: await hydrateCards(rows),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1)
  if (!product) return null

  const [images, options, variants, optionValues, category] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder)),

    db
      .select()
      .from(productOptions)
      .where(eq(productOptions.productId, product.id))
      .orderBy(asc(productOptions.sortOrder)),

    db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id))
      .orderBy(asc(productVariants.id)),

    db
      .select({
        id: productOptionValues.id,
        optionId: productOptionValues.optionId,
        definitionValueId: productOptionValues.definitionValueId,
        value: productOptionValues.value,
        swatchHex: productOptionValues.swatchHex,
        sortOrder: productOptionValues.sortOrder,
      })
      .from(productOptionValues)
      .innerJoin(productOptions, eq(productOptionValues.optionId, productOptions.id))
      .where(eq(productOptions.productId, product.id))
      .orderBy(asc(productOptionValues.sortOrder)),

    product.primaryCategoryId
      ? db
          .select({ id: categories.id, name: categories.name, slug: categories.slug })
          .from(categories)
          .where(eq(categories.id, product.primaryCategoryId))
          .limit(1)
      : Promise.resolve([]),
  ])

  const variantIds = variants.map((v) => v.id)
  const selections =
    variantIds.length > 0
      ? await db
          .select()
          .from(variantOptionValues)
          .where(inArray(variantOptionValues.variantId, variantIds))
      : []

  const selectionBy = new Map<number, Record<number, number>>()
  for (const row of selections) {
    const current = selectionBy.get(row.variantId) ?? {}
    current[row.optionId] = row.optionValueId
    selectionBy.set(row.variantId, current)
  }

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    isActive: product.isActive,
    isArchived: product.isArchived,
    ratingSum: product.ratingSum,
    ratingCount: product.ratingCount,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    primaryCategoryId: product.primaryCategoryId,
    images: images.map((i) => ({
      id: i.id,
      path: i.path,
      alt: i.alt,
      width: i.width,
      height: i.height,
      isPrimary: i.isPrimary,
    })),
    options: options.map((o) => ({
      id: o.id,
      definitionId: o.definitionId,
      name: o.name,
      kind: o.kind,
      note: o.note,
      values: optionValues
        .filter((v) => v.optionId === o.id)
        .map((v) => ({ id: v.id, definitionValueId: v.definitionValueId, value: v.value, swatchHex: v.swatchHex })),
    })),
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      price: v.price,
      discountPrice: v.discountPrice,
      effectivePrice: effectivePrice(v.price, v.discountPrice),
      stockQty: v.stockQty,
      lowStockThreshold: v.lowStockThreshold,
      isActive: v.isActive,
      imageId: v.imageId,
      selection: selectionBy.get(v.id) ?? {},
    })),
    category: category[0] ?? null,
  }
}

export async function findSlugRedirect(
  entityType: 'product' | 'category' | 'blog_post' | 'page',
  oldSlug: string,
): Promise<string | null> {
  const { slugRedirects } = await import('@/db/schema')
  const [row] = await db
    .select({ newSlug: slugRedirects.newSlug })
    .from(slugRedirects)
    .where(and(eq(slugRedirects.entityType, entityType), eq(slugRedirects.oldSlug, oldSlug)))
    .limit(1)
  return row?.newSlug ?? null
}

export async function relatedProducts(
  productId: number,
  categoryId: number | null,
  limit = 4,
): Promise<ProductCard[]> {
  const result = await listProducts({
    categoryId: categoryId ?? undefined,
    excludeId: productId,
    limit,
    sort: 'popular',
  })

  if (result.items.length >= limit) return result.items

  const filler = await listProducts({ excludeId: productId, limit, sort: 'popular' })
  const seen = new Set(result.items.map((i) => i.id))

  return [...result.items, ...filler.items.filter((i) => !seen.has(i.id))].slice(0, limit)
}

export async function listCategories(onlyVisible = true) {
  const conditions = onlyVisible ? [eq(categories.isVisible, true)] : []

  return db
    .select()
    .from(categories)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
}

export async function getCategoryBySlug(slug: string) {
  const [category] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1)
  return category ?? null
}

export async function categoryTrail(categoryId: number) {
  const trail: { id: number; name: string; slug: string }[] = []
  let currentId: number | null = categoryId

  for (let depth = 0; depth < 5 && currentId; depth++) {
    const [row]: { id: number; name: string; slug: string; parentId: number | null }[] = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        parentId: categories.parentId,
      })
      .from(categories)
      .where(eq(categories.id, currentId))
      .limit(1)

    if (!row) break
    trail.unshift({ id: row.id, name: row.name, slug: row.slug })
    currentId = row.parentId
  }

  return trail
}

export async function listOptionLibrary() {
  const [definitions, values] = await Promise.all([
    db.select().from(optionDefinitions).orderBy(asc(optionDefinitions.sortOrder), asc(optionDefinitions.name)),
    db.select().from(optionDefinitionValues).orderBy(asc(optionDefinitionValues.sortOrder)),
  ])
  return definitions.map((definition) => ({
    ...definition,
    values: values.filter((value) => value.definitionId === definition.id),
  }))
}

export async function categoryFacets(categoryId?: number) {
  const productFilter = categoryId
    ? and(
        eq(products.isActive, true),
        eq(products.isArchived, false),
        or(
          eq(products.primaryCategoryId, categoryId),
          inArray(
            products.id,
            db
              .select({ productId: productCategories.productId })
              .from(productCategories)
              .where(eq(productCategories.categoryId, categoryId)),
          ),
        )!,
      )
    : and(eq(products.isActive, true), eq(products.isArchived, false))

  const scoped = db.select({ id: products.id }).from(products).where(productFilter)

  const [values, [range]] = await Promise.all([
    db
      .selectDistinct({
        optionName: productOptions.name,
        kind: productOptions.kind,
        value: productOptionValues.value,
        swatchHex: productOptionValues.swatchHex,
      })
      .from(productOptionValues)
      .innerJoin(productOptions, eq(productOptionValues.optionId, productOptions.id))
      .where(inArray(productOptions.productId, scoped))
      .orderBy(asc(productOptionValues.sortOrder)),

    db
      .select({
        min: sql<number>`MIN(LEAST(${productVariants.price}, COALESCE(${productVariants.discountPrice}, ${productVariants.price})))`,
        max: sql<number>`MAX(LEAST(${productVariants.price}, COALESCE(${productVariants.discountPrice}, ${productVariants.price})))`,
      })
      .from(productVariants)
      .where(and(inArray(productVariants.productId, scoped), eq(productVariants.isActive, true))),
  ])

  return {
    colors: values.filter((v) => v.kind === 'color'),
    sizes: values.filter((v) => v.kind === 'size'),
    other: values.filter((v) => v.kind === 'other'),
    priceMin: Number(range?.min ?? 0),
    priceMax: Number(range?.max ?? 0),
  }
}
