export const PERMISSION_GROUPS = {
  products: 'محصولات',
  categories: 'دسته‌بندی‌ها',
  orders: 'سفارش‌ها',
  payments: 'پرداخت‌ها',
  customers: 'مشتریان',
  reviews: 'دیدگاه‌ها',
  sms: 'پیامک',
  content: 'محتوا',
  blog: 'وبلاگ',
  appearance: 'ظاهر سایت',
  seo: 'سئو',
  settings: 'تنظیمات',
  admins: 'مدیران',
  audit: 'گزارش فعالیت',
} as const

export type PermissionGroup = keyof typeof PERMISSION_GROUPS

export const PERMISSIONS = {
  'products.view': { group: 'products', label: 'مشاهده محصولات' },
  'products.create': { group: 'products', label: 'ایجاد محصول' },
  'products.update': { group: 'products', label: 'ویرایش محصول' },
  'products.delete': { group: 'products', label: 'حذف/بایگانی محصول' },
  'products.price': { group: 'products', label: 'تغییر قیمت' },
  'products.inventory': { group: 'products', label: 'تغییر موجودی' },

  'categories.view': { group: 'categories', label: 'مشاهده دسته‌بندی‌ها' },
  'categories.manage': { group: 'categories', label: 'مدیریت دسته‌بندی‌ها' },

  'orders.view': { group: 'orders', label: 'مشاهده سفارش‌ها' },
  'orders.update_status': { group: 'orders', label: 'تغییر وضعیت سفارش' },
  'orders.note': { group: 'orders', label: 'ثبت یادداشت داخلی' },

  'payments.view': { group: 'payments', label: 'مشاهده پرداخت‌ها' },
  'payments.approve': { group: 'payments', label: 'تأیید پرداخت' },
  'payments.reject': { group: 'payments', label: 'رد پرداخت' },

  'customers.view': { group: 'customers', label: 'مشاهده مشتریان' },
  'customers.manage': { group: 'customers', label: 'فعال/غیرفعال کردن حساب' },

  'reviews.view': { group: 'reviews', label: 'مشاهده دیدگاه‌ها' },
  'reviews.moderate': { group: 'reviews', label: 'تأیید/رد دیدگاه' },
  'reviews.reply': { group: 'reviews', label: 'پاسخ به دیدگاه' },
  'reviews.delete': { group: 'reviews', label: 'حذف دیدگاه' },

  'sms.view': { group: 'sms', label: 'مشاهده پیامک‌ها' },
  'sms.approve': { group: 'sms', label: 'تأیید ارسال پیامک' },
  'sms.configure': { group: 'sms', label: 'پیکربندی سرویس پیامک' },

  'content.pages': { group: 'content', label: 'مدیریت صفحات' },
  'content.homepage': { group: 'content', label: 'مدیریت صفحه اصلی' },

  'blog.view': { group: 'blog', label: 'مشاهده نوشته‌ها' },
  'blog.manage': { group: 'blog', label: 'مدیریت نوشته‌ها' },

  'appearance.theme': { group: 'appearance', label: 'تغییر رنگ‌بندی' },
  'appearance.typography': { group: 'appearance', label: 'تغییر تایپوگرافی' },
  'appearance.brand': { group: 'appearance', label: 'لوگو و هویت برند' },

  'seo.manage': { group: 'seo', label: 'مدیریت سئو' },

  'settings.view': { group: 'settings', label: 'مشاهده تنظیمات' },
  'settings.manage': { group: 'settings', label: 'تغییر تنظیمات' },
  'settings.payment': { group: 'settings', label: 'پیکربندی درگاه پرداخت' },
  'settings.enamad': { group: 'settings', label: 'مدیریت ای‌نماد' },

  'admins.view': { group: 'admins', label: 'مشاهده مدیران' },
  'admins.manage': { group: 'admins', label: 'مدیریت مدیران و نقش‌ها' },

  'audit.view': { group: 'audit', label: 'مشاهده گزارش فعالیت' },
} as const satisfies Record<string, { group: PermissionGroup; label: string }>

export type Permission = keyof typeof PERMISSIONS

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[]

export const DEFAULT_ROLES = [
  {
    key: 'superadmin',
    name: 'مدیر کل',
    description: 'دسترسی کامل به تمام بخش‌ها',
    isSystem: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'manager',
    name: 'مدیر فروشگاه',
    description: 'مدیریت محصولات، سفارش‌ها، پرداخت‌ها و محتوا',
    isSystem: false,
    permissions: [
      'products.view', 'products.create', 'products.update', 'products.delete',
      'products.price', 'products.inventory',
      'categories.view', 'categories.manage',
      'orders.view', 'orders.update_status', 'orders.note',
      'payments.view', 'payments.approve', 'payments.reject',
      'customers.view',
      'reviews.view', 'reviews.moderate', 'reviews.reply',
      'sms.view', 'sms.approve',
      'content.pages', 'content.homepage',
      'blog.view', 'blog.manage',
      'seo.manage',
      'settings.view',
    ] as Permission[],
  },
  {
    key: 'support',
    name: 'پشتیبانی',
    description: 'مشاهده سفارش‌ها و پاسخ به دیدگاه‌ها',
    isSystem: false,
    permissions: [
      'orders.view', 'orders.note',
      'payments.view',
      'customers.view',
      'reviews.view', 'reviews.reply',
      'products.view',
    ] as Permission[],
  },
  {
    key: 'content_editor',
    name: 'ویرایشگر محتوا',
    description: 'مدیریت وبلاگ و صفحات',
    isSystem: false,
    permissions: [
      'content.pages', 'content.homepage',
      'blog.view', 'blog.manage',
      'products.view',
      'seo.manage',
    ] as Permission[],
  },
] as const

export interface AdminPrincipal {
  id: number
  username: string
  fullName: string
  roleKey: string
  permissions: Set<Permission>
}

export function hasPermission(principal: AdminPrincipal, permission: Permission): boolean {
  if (principal.roleKey === 'superadmin') return true
  return principal.permissions.has(permission)
}

export function hasAnyPermission(
  principal: AdminPrincipal,
  permissions: readonly Permission[],
): boolean {
  if (principal.roleKey === 'superadmin') return true
  return permissions.some((p) => principal.permissions.has(p))
}

export function groupedPermissions() {
  const groups = new Map<PermissionGroup, { key: Permission; label: string }[]>()

  for (const [key, meta] of Object.entries(PERMISSIONS) as [
    Permission,
    { group: PermissionGroup; label: string },
  ][]) {
    const list = groups.get(meta.group) ?? []
    list.push({ key, label: meta.label })
    groups.set(meta.group, list)
  }

  return groups
}
