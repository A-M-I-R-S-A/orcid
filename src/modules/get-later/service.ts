import 'server-only'

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'

import { affectedRows, db } from '@/db'
import {
  addresses,
  getLaterCarts,
  getLaterItems,
  orderItems,
  orders,
  payments,
  productImages,
  productOptionValues,
  productOptions,
  products,
  productVariants,
  users,
  variantOptionValues,
} from '@/db/schema'
import { errors } from '@/lib/errors'
import { jalaliYear } from '@/lib/jalali'
import { effectivePrice } from '@/lib/money'
import { getBool, getNumber, getSetting } from '@/lib/settings'
import { getShippingConfig } from '@/lib/shipping-config'
import { calculateShipping } from '@/lib/shipping'
import { getEnabledMethods } from '@/modules/payments/registry'

export type GetLaterDecision = 'pay' | 'return'

export async function getConfig() {
  return {
    enabled: await getBool('get_later', 'enabled', false),
    title: await getSetting('get_later', 'title', 'سبد پرداخت بعدی'),
    description: await getSetting(
      'get_later',
      'description',
      'کالاهایی را که می‌خواهید نگه دارید مشخص کنید؛ مبلغ همان کالاها برای پرداخت آماده می‌شود.',
    ),
    deadlineDays: Math.min(30, Math.max(1, await getNumber('get_later', 'deadlineDays', 7))),
    submitLabel: await getSetting('get_later', 'submitLabel', 'ارسال اکنون'),
  }
}

export async function activeCountForUser(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(getLaterCarts)
    .where(and(eq(getLaterCarts.userId, userId), eq(getLaterCarts.status, 'open')))
  return Number(row?.count ?? 0)
}

export async function listForUser(userId: number) {
  return db
    .select({
      id: getLaterCarts.id,
      status: getLaterCarts.status,
      orderId: getLaterCarts.orderId,
      expiresAt: getLaterCarts.expiresAt,
      submittedAt: getLaterCarts.submittedAt,
      createdAt: getLaterCarts.createdAt,
      itemCount: sql<number>`(SELECT COALESCE(SUM(quantity), 0) FROM get_later_items WHERE cart_id = ${getLaterCarts.id})`,
      total: sql<number>`(SELECT COALESCE(SUM(unit_price * quantity), 0) FROM get_later_items WHERE cart_id = ${getLaterCarts.id} AND decision <> 'return')`,
    })
    .from(getLaterCarts)
    .where(and(eq(getLaterCarts.userId, userId), sql`${getLaterCarts.status} <> 'draft'`))
    .orderBy(desc(getLaterCarts.createdAt))
    .limit(50)
}

export async function getForUser(userId: number, cartId: number) {
  const [cart] = await db
    .select()
    .from(getLaterCarts)
    .where(and(eq(getLaterCarts.id, cartId), eq(getLaterCarts.userId, userId)))
    .limit(1)
  if (!cart) return null

  const items = await db
    .select()
    .from(getLaterItems)
    .where(eq(getLaterItems.cartId, cart.id))
    .orderBy(asc(getLaterItems.createdAt))

  return { ...cart, items }
}

export async function listForAdmin(options: { status?: string; search?: string } = {}) {
  const conditions = []
  if (options.status && options.status !== 'all') {
    conditions.push(sql`${getLaterCarts.status} = ${options.status}`)
  }
  if (options.search) {
    const term = `%${options.search}%`
    conditions.push(sql`(${users.phone} LIKE ${term} OR ${users.fullName} LIKE ${term})`)
  }

  return db
    .select({
      id: getLaterCarts.id,
      status: getLaterCarts.status,
      orderId: getLaterCarts.orderId,
      expiresAt: getLaterCarts.expiresAt,
      createdAt: getLaterCarts.createdAt,
      customerName: users.fullName,
      customerPhone: users.phone,
      itemCount: sql<number>`(SELECT COALESCE(SUM(quantity), 0) FROM get_later_items WHERE cart_id = ${getLaterCarts.id})`,
      total: sql<number>`(SELECT COALESCE(SUM(unit_price * quantity), 0) FROM get_later_items WHERE cart_id = ${getLaterCarts.id})`,
    })
    .from(getLaterCarts)
    .innerJoin(users, eq(getLaterCarts.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(getLaterCarts.createdAt))
    .limit(200)
}

export async function getForAdmin(cartId: number) {
  const [row] = await db
    .select({ cart: getLaterCarts, customerName: users.fullName, customerPhone: users.phone })
    .from(getLaterCarts)
    .innerJoin(users, eq(getLaterCarts.userId, users.id))
    .where(eq(getLaterCarts.id, cartId))
    .limit(1)
  if (!row) return null

  const items = await db
    .select()
    .from(getLaterItems)
    .where(eq(getLaterItems.cartId, cartId))
    .orderBy(asc(getLaterItems.createdAt))

  return { ...row.cart, customerName: row.customerName, customerPhone: row.customerPhone, items }
}

export async function createDraftForAdmin(adminId: number, phone: string): Promise<number> {
  const [user] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)
  if (!user) throw errors.notFound('مشتری با این شماره موبایل پیدا نشد.')
  if (!user.isActive) throw errors.conflict('حساب این مشتری غیرفعال است.')

  const config = await getConfig()
  try {
    const [inserted] = await db.insert(getLaterCarts).values({
      userId: user.id,
      activeUserId: user.id,
      createdByAdminId: adminId,
      status: 'draft',
      expiresAt: new Date(Date.now() + config.deadlineDays * 86_400_000),
    })
    return (inserted as unknown as { insertId: number }).insertId
  } catch (error) {
    if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') {
      throw errors.conflict('این مشتری از قبل یک سبد فعال یا پیش‌نویس دارد.')
    }
    throw error
  }
}

export async function addForUser(userId: number, variantId: number, quantity: number): Promise<number> {
  const config = await getConfig()
  if (!config.enabled) throw errors.conflict('خرید با تصمیم بعدی در حال حاضر فعال نیست.')
  if (!Number.isInteger(variantId) || variantId <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    throw errors.validation('کالا یا تعداد معتبر نیست.')
  }

  const [variant] = await db
    .select({ sku: productVariants.sku })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(productVariants.id, variantId), eq(productVariants.isActive, true), eq(products.isActive, true), eq(products.isArchived, false)))
    .limit(1)
  if (!variant) throw errors.notFound('این کالا برای فروش فعال نیست.')

  let [cart] = await db
    .select({ id: getLaterCarts.id, status: getLaterCarts.status, expiresAt: getLaterCarts.expiresAt })
    .from(getLaterCarts)
    .where(and(eq(getLaterCarts.userId, userId), eq(getLaterCarts.status, 'open')))
    .limit(1)

  if (cart?.expiresAt && cart.expiresAt.getTime() <= Date.now()) {
    await cancelCart(cart.id)
    cart = undefined
  }

  if (!cart) {
    try {
      const [inserted] = await db.insert(getLaterCarts).values({
        userId,
        activeUserId: userId,
        createdByAdminId: null,
        status: 'open',
        openedAt: new Date(),
        expiresAt: new Date(Date.now() + config.deadlineDays * 86_400_000),
      })
      cart = { id: (inserted as unknown as { insertId: number }).insertId, status: 'open', expiresAt: new Date(Date.now() + config.deadlineDays * 86_400_000) }
    } catch (error) {
      if ((error as { code?: string })?.code !== 'ER_DUP_ENTRY') throw error
      ;[cart] = await db.select({ id: getLaterCarts.id, status: getLaterCarts.status, expiresAt: getLaterCarts.expiresAt }).from(getLaterCarts).where(eq(getLaterCarts.activeUserId, userId)).limit(1)
      if (!cart) throw errors.conflict('سبد هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.')
    }
  }

  if (cart.status === 'draft') {
    await db.update(getLaterCarts).set({ status: 'open', openedAt: new Date() }).where(and(eq(getLaterCarts.id, cart.id), eq(getLaterCarts.status, 'draft')))
  }

  await addItem(cart.id, variant.sku, quantity)
  return cart.id
}

export async function addItem(cartId: number, sku: string, quantity: number): Promise<void> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    throw errors.validation('تعداد باید بین ۱ تا ۱۰۰ باشد.')
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM get_later_carts WHERE id = ${cartId} FOR UPDATE`)
    const [cart] = await tx
      .select({ status: getLaterCarts.status })
      .from(getLaterCarts)
      .where(eq(getLaterCarts.id, cartId))
      .limit(1)
    if (!cart) throw errors.notFound()
    if (cart.status !== 'draft' && cart.status !== 'open') throw errors.conflict('این سبد دیگر قابل ویرایش نیست.')

    const [variant] = await tx
      .select({
        id: productVariants.id,
        productId: products.id,
        sku: productVariants.sku,
        stockQty: productVariants.stockQty,
        price: productVariants.price,
        discountPrice: productVariants.discountPrice,
        variantActive: productVariants.isActive,
        productActive: products.isActive,
        productArchived: products.isArchived,
        productName: products.name,
        productSlug: products.slug,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(productVariants.sku, sku.trim()))
      .limit(1)
    if (!variant) throw errors.notFound('تنوعی با این کد کالا پیدا نشد.')
    if (!variant.variantActive || !variant.productActive || variant.productArchived) {
      throw errors.validation('این کالا برای فروش فعال نیست.')
    }

    await tx.execute(sql`SELECT id FROM product_variants WHERE id = ${variant.id} FOR UPDATE`)
    const [live] = await tx
      .select({ stockQty: productVariants.stockQty })
      .from(productVariants)
      .where(eq(productVariants.id, variant.id))
      .limit(1)
    if (!live || live.stockQty < quantity) throw errors.validation('موجودی این تنوع کافی نیست.')

    const [existing] = await tx
      .select({ id: getLaterItems.id, quantity: getLaterItems.quantity })
      .from(getLaterItems)
      .where(and(eq(getLaterItems.cartId, cartId), eq(getLaterItems.variantId, variant.id)))
      .limit(1)

    if (existing) {
      if (existing.quantity + quantity > 100) throw errors.validation('تعداد هر کالا نمی‌تواند بیشتر از ۱۰۰ باشد.')
      await tx
        .update(getLaterItems)
        .set({ quantity: sql`${getLaterItems.quantity} + ${quantity}` })
        .where(eq(getLaterItems.id, existing.id))
      return
    }

    const [image, labels] = await Promise.all([
      tx
        .select({ path: productImages.path })
        .from(productImages)
        .where(eq(productImages.productId, variant.productId))
        .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder))
        .limit(1),
      tx
        .select({ optionName: productOptions.name, value: productOptionValues.value })
        .from(variantOptionValues)
        .innerJoin(productOptions, eq(variantOptionValues.optionId, productOptions.id))
        .innerJoin(productOptionValues, eq(variantOptionValues.optionValueId, productOptionValues.id))
        .where(eq(variantOptionValues.variantId, variant.id))
        .orderBy(asc(productOptions.sortOrder)),
    ])

    await tx.insert(getLaterItems).values({
      cartId,
      variantId: variant.id,
      productId: variant.productId,
      productName: variant.productName,
      productSlug: variant.productSlug,
      variantLabel: labels.map((label) => `${label.optionName}: ${label.value}`).join(' • ') || null,
      sku: variant.sku,
      imagePath: image[0]?.path ?? null,
      originalPrice: variant.price,
      unitPrice: effectivePrice(variant.price, variant.discountPrice),
      quantity,
    })
  })
}

export async function setItemQuantity(cartId: number, itemId: number, quantity: number): Promise<void> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100) {
    throw errors.validation('تعداد باید بین صفر تا ۱۰۰ باشد.')
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM get_later_carts WHERE id = ${cartId} FOR UPDATE`)
    const [cart] = await tx.select({ status: getLaterCarts.status }).from(getLaterCarts).where(eq(getLaterCarts.id, cartId)).limit(1)
    if (!cart) throw errors.notFound()
    if (cart.status !== 'draft' && cart.status !== 'open') throw errors.conflict('این سبد دیگر قابل ویرایش نیست.')

    const [item] = await tx
      .select({ id: getLaterItems.id, variantId: getLaterItems.variantId, quantity: getLaterItems.quantity })
      .from(getLaterItems)
      .where(and(eq(getLaterItems.id, itemId), eq(getLaterItems.cartId, cartId)))
      .limit(1)
    if (!item) throw errors.notFound()

    if (quantity === 0) {
      await tx.delete(getLaterItems).where(eq(getLaterItems.id, item.id))
    } else {
      await tx.update(getLaterItems).set({ quantity }).where(eq(getLaterItems.id, item.id))
    }
  })
}

export async function updateDraft(
  cartId: number,
  input: { adminNote?: string; expiresAt?: Date | null },
): Promise<void> {
  const [cart] = await db.select({ status: getLaterCarts.status }).from(getLaterCarts).where(eq(getLaterCarts.id, cartId)).limit(1)
  if (!cart) throw errors.notFound()
  if (cart.status !== 'draft' && cart.status !== 'open') {
    throw errors.conflict('سبد نهایی‌شده یا لغوشده قابل ویرایش نیست.')
  }
  const changed = await db.update(getLaterCarts).set({
    adminNote: input.adminNote?.trim() || null,
    expiresAt: input.expiresAt ?? null,
  }).where(and(eq(getLaterCarts.id, cartId), inArray(getLaterCarts.status, ['draft', 'open'])))
  if (affectedRows(changed) === 0) throw errors.conflict('وضعیت سبد هم‌زمان تغییر کرده است.')
}

export async function openCart(cartId: number): Promise<void> {
  if (!(await getConfig()).enabled) {
    throw errors.conflict('ابتدا قابلیت خرید با تصمیم بعدی را از تنظیمات فعال کنید.')
  }
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM get_later_carts WHERE id = ${cartId} FOR UPDATE`)
    const [cart] = await tx
      .select({ status: getLaterCarts.status, expiresAt: getLaterCarts.expiresAt })
      .from(getLaterCarts)
      .where(eq(getLaterCarts.id, cartId))
      .limit(1)
    if (!cart) throw errors.notFound()
    if (cart.status !== 'draft') throw errors.conflict('این سبد دیگر در حالت پیش‌نویس نیست.')
    if (cart.expiresAt && cart.expiresAt.getTime() <= Date.now()) {
      throw errors.validation('مهلت سبد باید در آینده باشد.')
    }
    const [count] = await tx
      .select({ count: sql<number>`COUNT(*)` })
      .from(getLaterItems)
      .where(eq(getLaterItems.cartId, cartId))
    if (Number(count?.count ?? 0) === 0) throw errors.validation('پیش از فعال‌سازی حداقل یک کالا اضافه کنید.')
    await tx
      .update(getLaterCarts)
      .set({ status: 'open', openedAt: new Date() })
      .where(eq(getLaterCarts.id, cartId))
  })
}

export async function cancelCart(cartId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM get_later_carts WHERE id = ${cartId} FOR UPDATE`)
    const [cart] = await tx.select({ status: getLaterCarts.status }).from(getLaterCarts).where(eq(getLaterCarts.id, cartId)).limit(1)
    if (!cart) throw errors.notFound()
    if (cart.status !== 'draft' && cart.status !== 'open') {
      throw errors.conflict('سبد نهایی‌شده یا لغوشده قابل لغو دوباره نیست.')
    }
    await tx
      .update(getLaterCarts)
      .set({ status: 'cancelled', activeUserId: null })
      .where(eq(getLaterCarts.id, cartId))
  })
}

function orderNumberPrefix() {
  return `ORC-${jalaliYear()}-`
}

async function nextOrderNumber(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  const prefix = orderNumberPrefix()
  const [row] = await tx
    .select({ highest: sql<number | null>`MAX(SUBSTRING(${orders.orderNumber}, ${prefix.length + 1}) + 0)` })
    .from(orders)
    .where(sql`${orders.orderNumber} LIKE ${prefix + '%'}`)
  return prefix + String(Number(row?.highest ?? 0) + 1).padStart(6, '0')
}

function duplicateOrderNumber(error: unknown) {
  const value = error as { code?: string; errno?: number; message?: string }
  return (value?.code === 'ER_DUP_ENTRY' || value?.errno === 1062) && String(value?.message).includes('orders_number_unq')
}

export async function submitForUser(input: {
  userId: number
  cartId: number
  addressId: number
  paymentMethod: string
  customerNote?: string
  decisions: { itemId: number; decision: GetLaterDecision }[]
}): Promise<{ orderId: number | null }> {
  const preview = await getForUser(input.userId, input.cartId)
  if (!preview) throw errors.notFound()
  if (preview.status === 'converted') return { orderId: preview.orderId }
  if (preview.status !== 'open') throw errors.conflict('این سبد آماده ثبت تصمیم نیست.')

  const decisionById = new Map(input.decisions.map((item) => [item.itemId, item.decision]))
  if (decisionById.size !== preview.items.length || preview.items.some((item) => !decisionById.has(item.id))) {
    throw errors.validation('برای همه کالاها گزینه پرداخت یا بازگشت را انتخاب کنید.')
  }
  const payTotal = preview.items.reduce(
    (total, item) => total + (decisionById.get(item.id) === 'pay' ? item.unitPrice * item.quantity : 0),
    0,
  )
  const shippingConfig = await getShippingConfig()
  const quotedGrandTotal = payTotal + calculateShipping(payTotal, shippingConfig)
  const enabled = payTotal > 0 ? await getEnabledMethods({ amount: quotedGrandTotal }) : []
  if (payTotal > 0 && !enabled.some((method) => method.key === input.paymentMethod)) {
    throw errors.payment('روش پرداخت انتخاب‌شده برای این مبلغ در دسترس نیست.')
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM get_later_carts WHERE id = ${input.cartId} FOR UPDATE`)
        const [cart] = await tx
          .select()
          .from(getLaterCarts)
          .where(and(eq(getLaterCarts.id, input.cartId), eq(getLaterCarts.userId, input.userId)))
          .limit(1)
        if (!cart) throw errors.notFound()
        if (cart.status === 'converted') return { orderId: cart.orderId }
        if (cart.status === 'submitted') return { orderId: null }
        if (cart.status !== 'open') throw errors.conflict('این سبد دیگر قابل ثبت نیست.')
        if (cart.expiresAt && cart.expiresAt.getTime() < Date.now()) {
          throw errors.conflict('مهلت تصمیم‌گیری این سبد به پایان رسیده است. با پشتیبانی تماس بگیرید.')
        }

        await tx.execute(sql`SELECT id FROM get_later_items WHERE cart_id = ${cart.id} FOR UPDATE`)
        const items = await tx.select().from(getLaterItems).where(eq(getLaterItems.cartId, cart.id)).orderBy(asc(getLaterItems.id))
        if (decisionById.size !== items.length || items.some((item) => !decisionById.has(item.id))) {
          throw errors.conflict('اقلام سبد تغییر کرده‌اند. صفحه را تازه کنید.')
        }

        const kept = items.filter((item) => decisionById.get(item.id) === 'pay')
        for (const item of items) {
          await tx.update(getLaterItems).set({ decision: decisionById.get(item.id)! }).where(eq(getLaterItems.id, item.id))
        }

        if (kept.length === 0) {
          await tx.update(getLaterCarts).set({
            status: 'submitted',
            activeUserId: null,
            customerNote: input.customerNote?.trim() || null,
            submittedAt: new Date(),
          }).where(eq(getLaterCarts.id, cart.id))
          return { orderId: null }
        }

        const [address] = await tx
          .select()
          .from(addresses)
          .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, input.userId)))
          .limit(1)
        if (!address) throw errors.validation('یک نشانی معتبر انتخاب کنید.')

        for (const item of kept) {
          await tx.execute(sql`SELECT id FROM product_variants WHERE id = ${item.variantId} FOR UPDATE`)
          const [live] = await tx
            .select({ stockQty: productVariants.stockQty, price: productVariants.price, discountPrice: productVariants.discountPrice, isActive: productVariants.isActive })
            .from(productVariants)
            .where(eq(productVariants.id, item.variantId))
            .limit(1)
          if (!live?.isActive || effectivePrice(live.price, live.discountPrice) !== item.unitPrice) {
            throw errors.conflict(`قیمت یا وضعیت «${item.productName}» تغییر کرده است. آن را حذف و دوباره اضافه کنید.`)
          }
          const reserved = await tx
            .update(productVariants)
            .set({ stockQty: sql`${productVariants.stockQty} - ${item.quantity}` })
            .where(and(eq(productVariants.id, item.variantId), sql`${productVariants.stockQty} >= ${item.quantity}`))
          if (affectedRows(reserved) === 0) throw errors.conflict(`موجودی «${item.productName}» کافی نیست.`)
        }

        const subtotal = kept.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0)
        const discountTotal = kept.reduce((sum, item) => sum + (item.originalPrice - item.unitPrice) * item.quantity, 0)
        const merchandiseTotal = subtotal - discountTotal
        const shippingTotal = calculateShipping(merchandiseTotal, shippingConfig)
        const grandTotal = merchandiseTotal + shippingTotal
        const orderNumber = await nextOrderNumber(tx)

        const [inserted] = await tx.insert(orders).values({
          orderNumber,
          userId: input.userId,
          status: 'awaiting_payment',
          paymentStatus: 'pending',
          paymentMethod: input.paymentMethod,
          subtotal,
          discountTotal,
          shippingTotal,
          grandTotal,
          shipFullName: address.fullName,
          shipPhone: address.phone,
          shipProvince: address.province,
          shipCity: address.city,
          shipAddressLine: address.addressLine,
          shipPostalCode: address.postalCode,
          customerNote: input.customerNote?.trim() || null,
          internalNote: `ایجادشده از سبد پرداخت بعدی #${cart.id}`,
        })
        const orderId = (inserted as unknown as { insertId: number }).insertId

        await tx.insert(orderItems).values(kept.map((item) => ({
          orderId,
          variantId: item.variantId,
          productId: item.productId,
          productName: item.productName,
          productSlug: item.productSlug,
          variantLabel: item.variantLabel,
          sku: item.sku,
          imagePath: item.imagePath,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.unitPrice * item.quantity,
        })))
        await tx.insert(payments).values({
          orderId,
          userId: input.userId,
          method: input.paymentMethod,
          status: 'pending',
          amount: grandTotal,
        })
        for (const item of kept) {
          await tx.update(products).set({ salesCount: sql`${products.salesCount} + ${item.quantity}` }).where(eq(products.id, item.productId))
        }
        await tx.update(getLaterCarts).set({
          status: 'converted',
          activeUserId: null,
          orderId,
          customerNote: input.customerNote?.trim() || null,
          submittedAt: new Date(),
        }).where(eq(getLaterCarts.id, cart.id))

        return { orderId }
      })
    } catch (error) {
      if (attempt < 3 && duplicateOrderNumber(error)) continue
      throw error
    }
  }
  throw errors.conflict('ثبت سفارش انجام نشد. دوباره تلاش کنید.')
}
