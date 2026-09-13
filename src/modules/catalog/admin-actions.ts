'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import { categories, products, slugRedirects } from '@/db/schema'
import * as audit from '@/lib/audit'
import { CACHE_TAGS, invalidate } from '@/lib/cache'
import { type ActionResult, errors, fail, ok } from '@/lib/errors'
import { requirePermission } from '@/modules/admin/auth'
import { slugify, uniqueSlug } from '@/lib/slug'
import { deleteImageSet, processUpload } from '@/lib/images'
import * as service from './admin-service'

async function revalidateProduct(productId: number) {
  const [row] = await db
    .select({ slug: products.slug, categoryId: products.primaryCategoryId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  if (!row) return

  invalidate(CACHE_TAGS.products, CACHE_TAGS.homepage, CACHE_TAGS.sitemap)

  revalidatePath(`/product/${encodeURIComponent(row.slug)}`)
  revalidatePath('/')
  revalidatePath('/admin/products')
  revalidatePath('/admin/inventory')

  if (row.categoryId) {
    const [category] = await db
      .select({ slug: categories.slug })
      .from(categories)
      .where(eq(categories.id, row.categoryId))
      .limit(1)

    if (category) revalidatePath(`/category/${encodeURIComponent(category.slug)}`)
  }
}

export async function createProductAction(
  input: service.ProductInput,
): Promise<ActionResult<{ id: number }>> {
  try {
    const admin = await requirePermission('products.create')

    if (!input.name?.trim()) throw errors.validation('نام محصول الزامی است.')

    const id = await service.createProduct(admin, input)
    revalidatePath('/admin/products')

    return ok({ id })
  } catch (error) {
    return fail(error, { action: 'createProduct' })
  }
}

export async function updateProductAction(
  productId: number,
  input: service.ProductInput,
): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('products.update')

    if (!input.name?.trim()) throw errors.validation('نام محصول الزامی است.')

    await service.updateProduct(admin, productId, input)
    await revalidateProduct(productId)

    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'updateProduct', productId })
  }
}

export async function archiveProductAction(productId: number): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('products.delete')
    await service.archiveProduct(admin, productId)
    await revalidateProduct(productId)
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'archiveProduct', productId })
  }
}

export async function restoreProductAction(productId: number): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('products.delete')
    await service.restoreProduct(admin, productId)
    await revalidateProduct(productId)
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'restoreProduct', productId })
  }
}

export async function saveVariantAction(
  productId: number,
  input: service.VariantInput,
): Promise<ActionResult<{ id: number }>> {
  try {
    const admin = await requirePermission('products.update')
    if (input.id) {
      await requirePermission('products.price')
      await requirePermission('products.inventory')
    }

    if (!input.sku?.trim()) throw errors.validation('کد کالا (SKU) الزامی است.')

    const id = await service.saveVariant(admin, productId, input)
    await revalidateProduct(productId)

    return ok({ id })
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      return fail(errors.conflict('این کد کالا (SKU) قبلاً استفاده شده است.'))
    }
    return fail(error, { action: 'saveVariant', productId })
  }
}

export async function updateStockAction(input: {
  productId: number
  variantId: number
  stockQty: number
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('products.inventory')

    if (!Number.isInteger(input.stockQty) || input.stockQty < 0 || input.stockQty > 1_000_000_000) {
      throw errors.validation('موجودی باید یک عدد صحیح و غیرمنفی باشد.')
    }

    const { productVariants } = await import('@/db/schema')

    const [previous] = await db
      .select({ stockQty: productVariants.stockQty, sku: productVariants.sku })
      .from(productVariants)
      .where(eq(productVariants.id, input.variantId))
      .limit(1)

    const changed = await db
      .update(productVariants)
      .set({ stockQty: input.stockQty })
      .where(
        and(eq(productVariants.id, input.variantId), eq(productVariants.productId, input.productId)),
      )

    if (affectedRows(changed) === 0) throw errors.notFound('تنوع محصول پیدا نشد.')

    await audit.log({
      actor: admin,
      action: 'product.stock_change',
      entityType: 'variant',
      entityId: input.variantId,
      metadata: { from: previous?.stockQty, to: input.stockQty, sku: previous?.sku },
    })

    await revalidateProduct(input.productId)
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'updateStock', variantId: input.variantId })
  }
}

export async function deleteVariantAction(
  productId: number,
  variantId: number,
): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('products.update')
    await service.deleteVariant(admin, variantId)
    await revalidateProduct(productId)
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'deleteVariant', variantId })
  }
}

export async function saveOptionAction(
  productId: number,
  input: { id?: number; name: string; kind: 'size' | 'color' | 'other'; sortOrder: number },
): Promise<ActionResult<{ id: number }>> {
  try {
    await requirePermission('products.update')
    if (!input.name?.trim()) throw errors.validation('نام ویژگی الزامی است.')

    const id = await service.saveOption(productId, input)
    await service.rebuildSearchText(productId)
    await revalidateProduct(productId)

    return ok({ id })
  } catch (error) {
    return fail(error, { action: 'saveOption', productId })
  }
}

export async function adjustStockAction(input: {
  productId: number
  variantId: number
  delta: number
}): Promise<ActionResult<{ stockQty: number }>> {
  try {
    const admin = await requirePermission('products.inventory')
    if (!Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta) > 1_000_000) {
      throw errors.validation('مقدار تغییر موجودی معتبر نیست.')
    }

    const { productVariants } = await import('@/db/schema')
    const [previous] = await db
      .select({ stockQty: productVariants.stockQty, sku: productVariants.sku })
      .from(productVariants)
      .where(and(eq(productVariants.id, input.variantId), eq(productVariants.productId, input.productId)))
      .limit(1)
    if (!previous) throw errors.notFound('تنوع محصول پیدا نشد.')

    const changed = await db
      .update(productVariants)
      .set({ stockQty: sql`${productVariants.stockQty} + ${input.delta}` })
      .where(and(
        eq(productVariants.id, input.variantId),
        eq(productVariants.productId, input.productId),
        input.delta < 0 ? sql`${productVariants.stockQty} >= ${Math.abs(input.delta)}` : sql`1 = 1`,
      ))
    if (affectedRows(changed) === 0) throw errors.conflict('موجودی برای این مقدار کاهش کافی نیست.')

    const [current] = await db
      .select({ stockQty: productVariants.stockQty })
      .from(productVariants)
      .where(eq(productVariants.id, input.variantId))
      .limit(1)
    const stockQty = current?.stockQty ?? previous.stockQty + input.delta
    await audit.log({
      actor: admin,
      action: 'product.stock_change',
      entityType: 'variant',
      entityId: input.variantId,
      metadata: { from: previous.stockQty, to: stockQty, delta: input.delta, sku: previous.sku },
    })
    await revalidateProduct(input.productId)
    return ok({ stockQty })
  } catch (error) {
    return fail(error, { action: 'adjustStock', variantId: input.variantId, delta: input.delta })
  }
}

export async function deleteProductPermanentlyAction(productId: number): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('products.delete')
    const [product] = await db.select({ slug: products.slug }).from(products).where(eq(products.id, productId)).limit(1)
    await service.deleteProductPermanently(admin, productId)
    invalidate(CACHE_TAGS.products, CACHE_TAGS.homepage, CACHE_TAGS.sitemap)
    revalidatePath('/')
    if (product) revalidatePath(`/product/${encodeURIComponent(product.slug)}`)
    revalidatePath('/admin/products')
    revalidatePath('/admin/inventory')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'deleteProductPermanently', productId })
  }
}

export async function attachOptionAction(productId: number, definitionId: number, sortOrder: number): Promise<ActionResult<{ id: number }>> {
  try {
    await requirePermission('products.update')
    const id = await service.attachOption(productId, definitionId, sortOrder)
    await service.rebuildSearchText(productId)
    await revalidateProduct(productId)
    return ok({ id })
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return fail(errors.conflict('این ویژگی قبلاً به محصول اضافه شده است.'))
    return fail(error, { action: 'attachOption', productId, definitionId })
  }
}

export async function updateOptionDefinitionAction(
  productId: number,
  definitionId: number,
  input: { name: string; kind: 'size' | 'color' | 'other'; sortOrder: number },
): Promise<ActionResult<void>> {
  try {
    await requirePermission('products.update')
    await service.updateOptionDefinition(definitionId, input)
    await service.rebuildSearchText(productId)
    await revalidateProduct(productId)
    return ok(undefined)
  } catch (error) { return fail(error, { action: 'updateOptionDefinition', definitionId }) }
}

export async function deleteOptionDefinitionAction(productId: number, definitionId: number): Promise<ActionResult<void>> {
  try {
    await requirePermission('products.update')
    await service.deleteOptionDefinition(definitionId)
    await revalidateProduct(productId)
    return ok(undefined)
  } catch (error) { return fail(error, { action: 'deleteOptionDefinition', definitionId }) }
}

export async function updateOptionNoteAction(productId: number, optionId: number, note: string): Promise<ActionResult<void>> {
  try {
    await requirePermission('products.update')
    if (note.length > 500) throw errors.validation('نوت ویژگی حداکثر ۵۰۰ کاراکتر است.')
    await service.updateOptionNote(productId, optionId, note)
    await revalidateProduct(productId)
    return ok(undefined)
  } catch (error) { return fail(error, { action: 'updateOptionNote', productId, optionId }) }
}

export async function deleteOptionAction(productId: number, optionId: number): Promise<ActionResult<void>> {
  try {
    await requirePermission('products.update')
    await service.deleteOption(productId, optionId)
    await service.rebuildSearchText(productId)
    await revalidateProduct(productId)
    return ok(undefined)
  } catch (error) { return fail(error, { action: 'deleteOption', productId, optionId }) }
}

export async function saveOptionValueAction(
  productId: number,
  optionId: number,
  input: { id?: number; value: string; swatchHex?: string | null; sortOrder: number },
): Promise<ActionResult<{ id: number }>> {
  try {
    await requirePermission('products.update')
    if (!input.value?.trim()) throw errors.validation('مقدار ویژگی الزامی است.')

    const id = await service.saveOptionValue(optionId, input)
    await service.rebuildSearchText(productId)
    await revalidateProduct(productId)

    return ok({ id })
  } catch (error) {
    return fail(error, { action: 'saveOptionValue', optionId })
  }
}

export async function deleteOptionValueAction(productId: number, optionId: number, valueId: number): Promise<ActionResult<void>> {
  try {
    await requirePermission('products.update')
    await service.deleteOptionValue(optionId, valueId)
    await service.rebuildSearchText(productId)
    await revalidateProduct(productId)
    return ok(undefined)
  } catch (error) { return fail(error, { action: 'deleteOptionValue', productId, optionId, valueId }) }
}

export async function uploadProductImageAction(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  try {
    await requirePermission('products.update')

    const productId = Number(formData.get('productId'))
    const file = formData.get('file')
    const alt = String(formData.get('alt') ?? '')

    if (!Number.isInteger(productId) || productId <= 0) throw errors.validation('محصول نامعتبر است.')
    if (!(file instanceof File)) throw errors.validation('فایلی انتخاب نشده است.')

    const id = await service.addProductImage(productId, file, alt)
    await revalidateProduct(productId)

    return ok({ id })
  } catch (error) {
    return fail(error, { action: 'uploadProductImage' })
  }
}

export async function deleteProductImageAction(
  productId: number,
  imageId: number,
): Promise<ActionResult<void>> {
  try {
    await requirePermission('products.update')
    await service.deleteProductImage(imageId)
    await revalidateProduct(productId)
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'deleteProductImage', imageId })
  }
}

export async function setPrimaryImageAction(
  productId: number,
  imageId: number,
): Promise<ActionResult<void>> {
  try {
    await requirePermission('products.update')
    await service.setPrimaryImage(productId, imageId)
    await revalidateProduct(productId)
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'setPrimaryImage', imageId })
  }
}

export async function updateImageAltAction(
  productId: number,
  imageId: number,
  alt: string,
): Promise<ActionResult<void>> {
  try {
    await requirePermission('products.update')
    await service.updateImageAlt(imageId, alt)
    await revalidateProduct(productId)
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'updateImageAlt', imageId })
  }
}

export async function saveCategoryAction(input: {
  id?: number
  name: string
  slug?: string
  description?: string
  parentId?: number | null
  sortOrder: number
  isVisible: boolean
  seoTitle?: string
  seoDescription?: string
}): Promise<ActionResult<{ id: number }>> {
  try {
    const admin = await requirePermission('categories.manage')

    if (!input.name?.trim()) throw errors.validation('نام دسته‌بندی الزامی است.')

    if (input.id && input.parentId === input.id) {
      throw errors.validation('یک دسته‌بندی نمی‌تواند والد خودش باشد.')
    }

    if (input.id) {
      const [existing] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, input.id))
        .limit(1)

      if (!existing) throw errors.notFound()

      let slug = existing.slug
      if (input.slug && slugify(input.slug) !== existing.slug) {
        slug = await uniqueSlug(input.slug, async (candidate) => {
          const [conflict] = await db
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.slug, candidate))
            .limit(1)
          return Boolean(conflict) && conflict!.id !== input.id
        })

        await db
          .insert(slugRedirects)
          .values({ entityType: 'category', oldSlug: existing.slug, newSlug: slug })
          .onDuplicateKeyUpdate({ set: { newSlug: slug } })
      }

      await db
        .update(categories)
        .set({
          name: input.name,
          slug,
          description: input.description || null,
          parentId: input.parentId ?? null,
          sortOrder: input.sortOrder,
          isVisible: input.isVisible,
          seoTitle: input.seoTitle || null,
          seoDescription: input.seoDescription || null,
        })
        .where(eq(categories.id, input.id))

      await audit.log({
        actor: admin,
        action: 'category.update',
        entityType: 'category',
        entityId: input.id,
        summary: input.name,
      })

      invalidate(CACHE_TAGS.categories, CACHE_TAGS.homepage, CACHE_TAGS.sitemap)
      revalidatePath('/', 'layout')
      revalidatePath(`/category/${encodeURIComponent(slug)}`)

      return ok({ id: input.id })
    }

    const slug = await uniqueSlug(input.slug || input.name, async (candidate) => {
      const [conflict] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, candidate))
        .limit(1)
      return Boolean(conflict)
    })

    const [inserted] = await db.insert(categories).values({
      name: input.name,
      slug,
      description: input.description || null,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder,
      isVisible: input.isVisible,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
    })

    const id = (inserted as unknown as { insertId: number }).insertId

    await audit.log({
      actor: admin,
      action: 'category.create',
      entityType: 'category',
      entityId: id,
      summary: input.name,
    })

    invalidate(CACHE_TAGS.categories, CACHE_TAGS.homepage, CACHE_TAGS.sitemap)
    revalidatePath('/', 'layout')
    return ok({ id })
  } catch (error) {
    return fail(error, { action: 'saveCategory' })
  }
}

export async function deleteCategoryAction(categoryId: number): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('categories.manage')

    const [inUse] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.primaryCategoryId, categoryId))
      .limit(1)

    if (inUse) {
      throw errors.conflict(
        'این دسته‌بندی دارای محصول است. ابتدا محصولات را به دسته دیگری منتقل کنید.',
      )
    }

    const [child] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, categoryId))
      .limit(1)

    if (child) {
      throw errors.conflict('این دسته‌بندی زیرمجموعه دارد. ابتدا زیرمجموعه‌ها را حذف کنید.')
    }

    const [category] = await db
      .select({ imagePath: categories.imagePath })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1)

    await db.delete(categories).where(eq(categories.id, categoryId))

    if (category?.imagePath) await deleteImageSet(category.imagePath)

    await audit.log({
      actor: admin,
      action: 'category.delete',
      entityType: 'category',
      entityId: categoryId,
    })

    invalidate(CACHE_TAGS.categories, CACHE_TAGS.homepage, CACHE_TAGS.sitemap)
    revalidatePath('/', 'layout')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'deleteCategory', categoryId })
  }
}

export async function uploadCategoryImageAction(
  formData: FormData,
): Promise<ActionResult<void>> {
  try {
    await requirePermission('categories.manage')

    const categoryId = Number(formData.get('categoryId'))
    const file = formData.get('file')

    if (!(file instanceof File)) throw errors.validation('فایلی انتخاب نشده است.')

    const [existing] = await db
      .select({ imagePath: categories.imagePath })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1)

    const processed = await processUpload(file, { folder: 'categories' })

    await db
      .update(categories)
      .set({ imagePath: processed.path })
      .where(eq(categories.id, categoryId))

    if (existing?.imagePath) await deleteImageSet(existing.imagePath)

    invalidate(CACHE_TAGS.categories, CACHE_TAGS.homepage)
    revalidatePath('/', 'layout')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'uploadCategoryImage' })
  }
}
