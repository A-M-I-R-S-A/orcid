import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'

import * as schema from '../src/db/schema'
import { ALL_PERMISSIONS, DEFAULT_ROLES, PERMISSIONS } from '../src/lib/permissions'
import { DEFAULT_THEME } from '../src/lib/color'
import { DEFAULT_TYPOGRAPHY } from '../src/lib/typography'
import { hashPassword } from '../src/lib/crypto'
import { normalizePersian } from '../src/lib/persian'
import { slugify } from '../src/lib/slug'

import { SIZE_GUIDE_SLUG } from '../src/lib/size-guide'

const withDemo = process.argv.includes('--demo')

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4_unicode_ci',
  connectionLimit: 2,
})

const db = drizzle(pool, { schema, mode: 'default' })

async function seedPermissions() {
  console.log('→ Permissions')

  for (const key of ALL_PERMISSIONS) {
    const meta = PERMISSIONS[key]
    await db
      .insert(schema.permissions)
      .values({ key, groupKey: meta.group, label: meta.label })
      .onDuplicateKeyUpdate({ set: { groupKey: meta.group, label: meta.label } })
  }

  const live = await db.select({ key: schema.permissions.key }).from(schema.permissions)
  const stale = live.filter((row) => !ALL_PERMISSIONS.includes(row.key as never))

  for (const row of stale) {
    await db.delete(schema.permissions).where(eq(schema.permissions.key, row.key))
    console.log(`  · removed stale permission ${row.key}`)
  }

  console.log(`  ✓ ${ALL_PERMISSIONS.length} permissions`)
}

async function seedRoles() {
  console.log('→ Roles')

  const permissionRows = await db
    .select({ id: schema.permissions.id, key: schema.permissions.key })
    .from(schema.permissions)
  const idByKey = new Map(permissionRows.map((r) => [r.key, r.id]))

  for (const role of DEFAULT_ROLES) {
    await db
      .insert(schema.roles)
      .values({
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      })
      .onDuplicateKeyUpdate({ set: { name: role.name, description: role.description } })

    const [row] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.key, role.key))
      .limit(1)

    if (!row) continue

    if (role.key === 'superadmin') {
      console.log(`  ✓ ${role.name} (bypasses permission table)`)
      continue
    }

    await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, row.id))

    const values = role.permissions
      .map((key) => idByKey.get(key))
      .filter((id): id is number => id != null)
      .map((permissionId) => ({ roleId: row.id, permissionId }))

    if (values.length > 0) {
      await db.insert(schema.rolePermissions).values(values)
    }

    console.log(`  ✓ ${role.name} — ${values.length} permissions`)
  }
}

async function seedAdminUser() {
  console.log('→ Administrator')

  const [existing] = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).limit(1)

  if (existing) {
    console.log('  · an administrator already exists — skipping')
    return
  }

  const [role] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.key, 'superadmin'))
    .limit(1)

  if (!role) throw new Error('superadmin role missing — seedRoles must run first')

  const password = randomBytes(12).toString('base64url')

  await db.insert(schema.adminUsers).values({
    username: 'admin',
    fullName: 'مدیر ارکید',
    passwordHash: await hashPassword(password),
    roleId: role.id,
    isActive: true,
  })

  console.log('\n  ┌──────────────────────────────────────────────┐')
  console.log('  │  ADMINISTRATOR CREATED — SHOWN ONCE          │')
  console.log('  ├──────────────────────────────────────────────┤')
  console.log('  │  username: admin                             │')
  console.log(`  │  password: ${password.padEnd(34)}│`)
  console.log('  ├──────────────────────────────────────────────┤')
  console.log('  │  Store this in a password manager and        │')
  console.log('  │  change it after first sign-in.              │')
  console.log('  └──────────────────────────────────────────────┘\n')
}

async function seedSettings() {
  console.log('→ Settings')

  const put = async (
    namespace: string,
    values: Record<string, string>,
    isSecret = false,
  ) => {
    for (const [key, value] of Object.entries(values)) {
      await db
        .insert(schema.settings)
        .values({ namespace, key, value, isSecret })
        .onDuplicateKeyUpdate({ set: { namespace: sql`${schema.settings.namespace}` } })
    }
  }

  await put('theme', DEFAULT_THEME)
  await put('typography', {
    headingFont: DEFAULT_TYPOGRAPHY.headingFont,
    bodyFont: DEFAULT_TYPOGRAPHY.bodyFont,
    baseSize: DEFAULT_TYPOGRAPHY.baseSize,
    scale: DEFAULT_TYPOGRAPHY.scale,
  })

  await put('site', {
    siteName: 'ارکید',
    tagline: 'لباس زیر زنانه، با ظرافتی که حس می‌شود.',
    announcementText: '',
    footerNote: '',
  })

  await put('seo', {
    defaultTitle: 'ارکید — فروشگاه لباس زیر زنانه',
    defaultDescription:
      'فروشگاه اینترنتی ارکید؛ لباس زیر زنانه با کیفیت، طراحی ظریف و ارسال محرمانه به سراسر ایران.',
    titleSeparator: ' | ',
  })

  await put('contact', { phone: '', email: '', address: '', workingHours: '' })
  await put('social', { instagram: '', telegram: '', whatsapp: '' })
  await put('shipping', { shippingInfo: '', returnPolicy: '' })
  await put('enamad', { embedCode: '', metaTag: '' })

  await put('payment_card', {
    enabled: '1',
    bankName: '',
    cardNumber: '',
    accountHolder: '',
    instructions:
      'پس از واریز مبلغ سفارش به شماره کارت بالا، کد رهگیری تراکنش را در فرم زیر ثبت کنید. سفارش شما پس از بررسی و تأیید پرداخت، پردازش خواهد شد.',
  })

  await put('torob', { enabled: '0' })
  await put('sms', { provider: 'sms_ir' })

  await db
    .insert(schema.settingsVersion)
    .values({ id: 1, version: 1 })
    .onDuplicateKeyUpdate({ set: { id: 1 } })

  console.log('  ✓ default settings')
}

async function seedSmsTemplates() {
  console.log('→ SMS templates')

  const templates = [
    {
      event: 'otp_login' as const,
      name: 'کد ورود',
      requiresApproval: false,
      parameters: ['CODE'],
    },
    {
      event: 'order_created' as const,
      name: 'ثبت سفارش',
      requiresApproval: true,
      parameters: ['ORDER', 'AMOUNT'],
    },
    {
      event: 'payment_approved' as const,
      name: 'تأیید پرداخت',
      requiresApproval: true,
      parameters: ['ORDER'],
    },
    {
      event: 'order_shipped' as const,
      name: 'ارسال سفارش',
      requiresApproval: true,
      parameters: ['ORDER'],
    },
  ]

  for (const template of templates) {
    await db
      .insert(schema.smsTemplates)
      .values({
        event: template.event,
        name: template.name,
        parameters: template.parameters,
        isEnabled: false,
        requiresApproval: template.requiresApproval,
      })
      .onDuplicateKeyUpdate({ set: { name: template.name, parameters: template.parameters } })
  }

  console.log(`  ✓ ${templates.length} templates (disabled until configured)`)
}

async function seedHomepage() {
  console.log('→ Homepage sections')

  const sections = [
    { kind: 'hero' as const, title: 'ظرافت، در هر جزئیات', subtitle: 'مجموعه‌ای از لباس‌های زیر زنانه با پارچه‌های نرم و دوخت دقیق.', linkUrl: '/', linkLabel: 'مشاهده مجموعه', sortOrder: 0 },
    { kind: 'categories' as const, title: 'خرید بر اساس دسته', subtitle: null, linkUrl: null, linkLabel: null, sortOrder: 1 },
    { kind: 'featured_products' as const, title: 'محصولات منتخب', subtitle: null, linkUrl: null, linkLabel: null, sortOrder: 2 },
    { kind: 'promo_banner' as const, title: 'ارسال محرمانه به سراسر ایران', subtitle: 'بسته‌بندی بدون نشان، با احترام کامل به حریم خصوصی شما.', linkUrl: '/p/shipping', linkLabel: 'اطلاعات ارسال', sortOrder: 3 },
    { kind: 'new_arrivals' as const, title: 'جدیدترین‌ها', subtitle: null, linkUrl: null, linkLabel: null, sortOrder: 4 },
    { kind: 'bestsellers' as const, title: 'انتخاب مشتریان', subtitle: null, linkUrl: null, linkLabel: null, sortOrder: 5 },
    { kind: 'brand_story' as const, title: 'ارکید', subtitle: 'ما باور داریم لباس زیر باید هم زیبا باشد و هم راحت. هر قطعه با انتخاب دقیق پارچه و توجه به جزئیات دوخت آماده می‌شود.', linkUrl: '/p/about', linkLabel: 'درباره ارکید', sortOrder: 6 },
    { kind: 'blog_teaser' as const, title: 'خواندنی‌ها', subtitle: null, linkUrl: null, linkLabel: null, sortOrder: 7 },
  ]

  const [existing] = await db.select({ id: schema.homepageSections.id }).from(schema.homepageSections).limit(1)
  if (existing) {
    console.log('  · homepage already configured — skipping')
    return
  }

  await db.insert(schema.homepageSections).values(
    sections.map((s) => ({ ...s, isVisible: true, config: { limit: 8 } })),
  )

  console.log(`  ✓ ${sections.length} sections`)
}

async function seedPages() {
  console.log('→ CMS pages')

  const pages = [
    {
      slug: 'about',
      title: 'درباره ارکید',
      showInFooter: true,
      sortOrder: 0,
      body:
        '<p>ارکید با یک ایده ساده شکل گرفت: لباس زیری که هر روز می‌پوشید باید همان‌قدر راحت باشد که زیبا است.</p>' +
        '<h2>چطور شروع شد</h2>' +
        '<p>خرید لباس زیر برای بسیاری از ما تجربه‌ای پر از تردید بوده است؛ سایزهایی که با هم نمی‌خوانند، پارچه‌هایی که بعد از چند بار شستشو فرم خود را از دست می‌دهند و فروشگاه‌هایی که پاسخ سوال‌ها را نمی‌دهند. ارکید را ساختیم تا این تجربه ساده، روشن و قابل اعتماد شود.</p>' +
        '<h2>انتخاب محصول</h2>' +
        '<p>هر مدل پیش از اضافه شدن به مجموعه بررسی می‌شود: جنس و وزن پارچه، کیفیت دوخت، رفتار کش‌ها بعد از شستشو و راحتی در پوشیدن طولانی‌مدت. اگر قطعه‌ای این معیارها را نگذراند، وارد فروشگاه نمی‌شود.</p>' +
        '<h2>حریم خصوصی شما</h2>' +
        '<p>می‌دانیم این خرید شخصی است. بسته‌ها بدون نشان و بدون اشاره به محتوای داخل ارسال می‌شوند و اطلاعات سفارش شما نزد ما می‌ماند.</p>',
    },
    {
      slug: 'contact',
      title: 'تماس با ما',
      showInFooter: true,
      sortOrder: 1,
      body:
        '<p>هر پرسشی درباره انتخاب سایز، وضعیت سفارش یا شرایط بازگشت دارید، از نزدیک‌ترین راه ارتباطی با ما در میان بگذارید.</p>' +
        '<p>برای پیگیری سریع‌تر، لطفاً شماره سفارش یا شماره موبایلی که با آن ثبت‌نام کرده‌اید را همراه پیام بفرستید.</p>',
    },
    {
      slug: 'faq',
      title: 'سوالات متداول',
      showInFooter: true,
      sortOrder: 2,
      body:
        '<p>پاسخ پرتکرارترین پرسش‌های مشتریان ارکید را اینجا جمع کرده‌ایم.</p>' +
        '<h2>سایز و انتخاب</h2>' +
        '<h3>چگونه سایز مناسب را انتخاب کنم؟</h3>' +
        '<p>در صفحه هر محصول جدول سایز اختصاصی همان مدل قرار دارد. با یک متر نواری دور سینه، دور زیر سینه و دور باسن را اندازه بگیرید و با جدول مقایسه کنید.</p>' +
        '<h3>اندازه من بین دو سایز است، کدام را بگیرم؟</h3>' +
        '<p>سایز بزرگ‌تر را انتخاب کنید. لباس زیر تنگ در ساعات طولانی آزاردهنده می‌شود و کش‌ها زودتر فرم خود را از دست می‌دهند.</p>' +
        '<h3>سایزبندی همه محصولات یکسان است؟</h3>' +
        '<p>خیر. سایزبندی بسته به مدل و جنس پارچه متفاوت است؛ به همین دلیل برای هر محصول جدول جداگانه منتشر می‌کنیم.</p>' +
        '<h2>سفارش و پرداخت</h2>' +
        '<h3>برای ثبت سفارش باید حساب کاربری بسازم؟</h3>' +
        '<p>بله. ورود با شماره موبایل و کد پیامکی انجام می‌شود تا بتوانید سفارش‌ها و آدرس‌های خود را در حساب کاربری پیگیری کنید.</p>' +
        '<h3>روش‌های پرداخت چیست؟</h3>' +
        '<p>پرداخت اینترنتی با کارت‌های عضو شتاب انجام می‌شود. روش‌های فعال در مرحله نهایی ثبت سفارش نمایش داده می‌شوند.</p>' +
        '<h3>سفارشم را چطور پیگیری کنم؟</h3>' +
        '<p>وضعیت لحظه‌ای سفارش در بخش «سفارش‌های من» در حساب کاربری شما در دسترس است و در هر تغییر وضعیت پیامک دریافت می‌کنید.</p>' +
        '<h2>ارسال و بسته‌بندی</h2>' +
        '<h3>سفارش چند روز بعد به دستم می‌رسد؟</h3>' +
        '<p>سفارش‌ها پس از تأیید پرداخت آماده‌سازی و تحویل پست می‌شوند. زمان دقیق ارسال بسته به شهر مقصد در صفحه شیوه ارسال آمده است.</p>' +
        '<h3>بسته‌بندی چگونه است؟</h3>' +
        '<p>بسته‌بندی ساده و بدون نشان است. روی بسته هیچ اشاره‌ای به نوع محصول یا نام فروشگاه نوشته نمی‌شود.</p>' +
        '<h3>به همه شهرها ارسال می‌کنید؟</h3>' +
        '<p>بله، به تمام شهرهای کشور ارسال داریم.</p>' +
        '<h2>بازگشت و پشتیبانی</h2>' +
        '<h3>امکان بازگشت کالا وجود دارد؟</h3>' +
        '<p>به دلیل ماهیت بهداشتی این محصولات، بازگشت تنها در صورت وجود ایراد در دوخت، مغایرت با سفارش یا ارسال اشتباه پذیرفته می‌شود. جزئیات کامل در صفحه شرایط بازگشت کالا آمده است.</p>' +
        '<h3>محصول با ایراد دریافت کرده‌ام، چه کنم؟</h3>' +
        '<p>حداکثر تا ۴۸ ساعت پس از تحویل با پشتیبانی تماس بگیرید و عکس محصول را ارسال کنید تا تعویض یا بازگشت وجه انجام شود.</p>' +
        '<h3>چطور با پشتیبانی در تماس باشم؟</h3>' +
        '<p>راه‌های ارتباطی و ساعات پاسخگویی در صفحه تماس با ما فهرست شده‌اند.</p>',
    },
    { slug: 'shipping', title: 'شیوه ارسال', showInFooter: true, sortOrder: 3, body: '<p>سفارش‌ها در بسته‌بندی بدون نشان و کاملاً محرمانه ارسال می‌شوند.</p>' },
    { slug: 'returns', title: 'شرایط بازگشت کالا', showInFooter: true, sortOrder: 4, body: '<p>به دلیل ماهیت بهداشتی این محصولات، امکان بازگشت تنها در صورت وجود ایراد در دوخت یا ارسال اشتباه وجود دارد.</p>' },
    { slug: 'terms', title: 'قوانین و مقررات', showInFooter: true, sortOrder: 5, body: '<p>با ثبت سفارش در ارکید، قوانین زیر را می‌پذیرید.</p>' },
    { slug: 'privacy', title: 'حریم خصوصی', showInFooter: true, sortOrder: 6, body: '<p>اطلاعات شخصی شما تنها برای پردازش سفارش استفاده می‌شود و در اختیار هیچ شخص ثالثی قرار نمی‌گیرد.</p>' },
    {
      slug: SIZE_GUIDE_SLUG,
      title: 'راهنمای سایز',
      showInFooter: true,
      sortOrder: 7,
      body:
        '<h2>چگونه اندازه بگیریم؟</h2>' +
        '<p>با یک متر نواری و روی لباس نازک اندازه بگیرید. متر باید صاف بماند و کشیده نشود.</p>' +
        '<h3>دور سینه</h3><p>متر را از پرترین قسمت سینه و موازی با زمین عبور دهید.</p>' +
        '<h3>دور زیر سینه</h3><p>بلافاصله زیر سینه، جایی که بند سوتین می‌نشیند.</p>' +
        '<h3>دور باسن</h3><p>پرترین قسمت باسن، با پاهای جفت.</p>' +
        '<p>اگر اندازه‌تان بین دو سایز بود، سایز بزرگ‌تر را انتخاب کنید.</p>',
    },
  ]

  for (const page of pages) {
    await db
      .insert(schema.pages)
      .values({
        slug: page.slug,
        title: page.title,
        body: page.body,
        isPublished: true,
        showInFooter: page.showInFooter,
        sortOrder: page.sortOrder,
      })
      .onDuplicateKeyUpdate({ set: { slug: sql`${schema.pages.slug}` } })
  }

  console.log(`  ✓ ${pages.length} pages`)
}

async function seedDemoCatalog() {
  console.log('→ Demo catalogue')

  const [existing] = await db.select({ id: schema.products.id }).from(schema.products).limit(1)
  if (existing) {
    console.log('  · products already exist — skipping demo data')
    return
  }

  const categoryDefs = [
    { name: 'سوتین', description: 'انواع سوتین با فوم، بدون فوم و اسفنجی' },
    { name: 'شورت', description: 'شورت‌های راحت با پارچه‌های نخی و لطیف' },
    { name: 'ست لباس زیر', description: 'ست‌های هماهنگ سوتین و شورت' },
    { name: 'لباس خواب', description: 'لباس خواب و ساتن راحتی' },
  ]

  const categoryIds: number[] = []

  for (const [index, def] of categoryDefs.entries()) {
    const [inserted] = await db.insert(schema.categories).values({
      name: def.name,
      slug: slugify(def.name),
      description: def.description,
      sortOrder: index,
      isVisible: true,
    })
    categoryIds.push((inserted as unknown as { insertId: number }).insertId)
  }

  const productDefs = [
    { name: 'سوتین بدون فنر نخی', categoryIndex: 0, price: 285_000, short: 'سوتین راحت بدون فنر با پارچه نخی نرم', featured: true, isNew: true },
    { name: 'سوتین فوم‌دار ساده', categoryIndex: 0, price: 340_000, discount: 289_000, short: 'فوم سبک با پوشش کامل و بند قابل تنظیم', featured: true, bestseller: true },
    { name: 'شورت نخی راحت', categoryIndex: 1, price: 95_000, short: 'شورت نخی با کش نرم و دوخت تمیز', bestseller: true },
    { name: 'ست سوتین و شورت توری', categoryIndex: 2, price: 520_000, discount: 449_000, short: 'ست هماهنگ با توری ظریف و آستر نخی', featured: true, isNew: true },
    { name: 'لباس خواب ساتن بلند', categoryIndex: 3, price: 680_000, short: 'ساتن نرم با برش راحت و بند نازک', isNew: true },
    { name: 'سوتین اسپرت بدون درز', categoryIndex: 0, price: 265_000, short: 'بدون درز، مناسب استفاده روزمره و ورزش سبک' },
  ]

  const sizes = ['۷۰B', '۷۵B', '۸۰B', '۸۵C']
  const colors = [
    { value: 'مشکی', hex: '#1A1A1A' },
    { value: 'کرم', hex: '#EDE6DC' },
    { value: 'زرشکی', hex: '#4A171E' },
  ]

  let skuCounter = 1000

  for (const def of productDefs) {
    const [insertedProduct] = await db.insert(schema.products).values({
      name: def.name,
      slug: slugify(def.name),
      shortDescription: def.short,
      description: `${def.short}\n\nجنس پارچه با دقت انتخاب شده تا در تماس با پوست کاملاً راحت باشد. دوخت لبه‌ها تمیز و بدون زبری است.`,
      primaryCategoryId: categoryIds[def.categoryIndex],
      isActive: true,
      isFeatured: def.featured ?? false,
      isNewArrival: def.isNew ?? false,
      isBestseller: def.bestseller ?? false,
      publishedAt: new Date(),
      searchText: normalizePersian(
        [def.name, def.short, categoryDefs[def.categoryIndex]!.name, ...sizes, ...colors.map((c) => c.value)].join(' '),
      ),
    })

    const productId = (insertedProduct as unknown as { insertId: number }).insertId

    const [sizeOption] = await db.insert(schema.productOptions).values({
      productId,
      name: 'سایز',
      kind: 'size',
      sortOrder: 0,
    })
    const sizeOptionId = (sizeOption as unknown as { insertId: number }).insertId

    const [colorOption] = await db.insert(schema.productOptions).values({
      productId,
      name: 'رنگ',
      kind: 'color',
      sortOrder: 1,
    })
    const colorOptionId = (colorOption as unknown as { insertId: number }).insertId

    const sizeValueIds: number[] = []
    for (const [index, size] of sizes.entries()) {
      const [row] = await db.insert(schema.productOptionValues).values({
        optionId: sizeOptionId,
        value: size,
        sortOrder: index,
      })
      sizeValueIds.push((row as unknown as { insertId: number }).insertId)
    }

    const colorValueIds: number[] = []
    for (const [index, color] of colors.entries()) {
      const [row] = await db.insert(schema.productOptionValues).values({
        optionId: colorOptionId,
        value: color.value,
        swatchHex: color.hex,
        sortOrder: index,
      })
      colorValueIds.push((row as unknown as { insertId: number }).insertId)
    }

    for (const [sizeIndex, sizeValueId] of sizeValueIds.entries()) {
      for (const [colorIndex, colorValueId] of colorValueIds.entries()) {
        const [variant] = await db.insert(schema.productVariants).values({
          productId,
          sku: `ORC-${skuCounter++}`,
          price: def.price,
          discountPrice: def.discount ?? null,
          stockQty: (sizeIndex * 3 + colorIndex * 2) % 7,
          isActive: true,
        })

        const variantId = (variant as unknown as { insertId: number }).insertId

        await db.insert(schema.variantOptionValues).values([
          { variantId, optionId: sizeOptionId, optionValueId: sizeValueId },
          { variantId, optionId: colorOptionId, optionValueId: colorValueId },
        ])
      }
    }

    console.log(`  ✓ ${def.name} — ${sizeValueIds.length * colorValueIds.length} variants`)
  }

  await db.insert(schema.blogCategories).values([
    { name: 'راهنمای خرید', slug: 'buying-guide' },
    { name: 'نگهداری لباس', slug: 'garment-care' },
  ])

  console.log('  ✓ demo catalogue complete (no images — upload via admin panel)')
}

async function main() {
  console.log('\nOrchid — database seed\n')

  await seedPermissions()
  await seedRoles()
  await seedAdminUser()
  await seedSettings()
  await seedSmsTemplates()
  await seedHomepage()
  await seedPages()

  if (withDemo) await seedDemoCatalog()

  console.log('\n✓ Seed complete.\n')
}

main()
  .catch((error) => {
    console.error('\n✗ Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
