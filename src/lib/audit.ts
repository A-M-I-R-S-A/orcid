import 'server-only'

import { db } from '@/db'
import { auditLogs } from '@/db/schema'
import { redact } from './errors'
import type { AdminPrincipal } from './permissions'

export const AUDIT_ACTIONS = {
  'product.create': 'ایجاد محصول',
  'product.update': 'ویرایش محصول',
  'product.archive': 'بایگانی محصول',
  'product.price_change': 'تغییر قیمت',
  'product.stock_change': 'تغییر موجودی',

  'category.create': 'ایجاد دسته‌بندی',
  'category.update': 'ویرایش دسته‌بندی',
  'category.delete': 'حذف دسته‌بندی',

  'order.status_change': 'تغییر وضعیت سفارش',
  'order.note': 'ثبت یادداشت سفارش',

  'payment.approve': 'تأیید پرداخت',
  'payment.reject': 'رد پرداخت',

  'customer.disable': 'غیرفعال‌سازی حساب مشتری',
  'customer.enable': 'فعال‌سازی حساب مشتری',

  'review.moderate': 'بررسی دیدگاه',
  'review.reply': 'پاسخ به دیدگاه',
  'review.delete': 'حذف دیدگاه',

  'sms.approve': 'تأیید ارسال پیامک',
  'sms.config_change': 'تغییر تنظیمات پیامک',
  'sms.template_change': 'تغییر قالب پیامک',

  'theme.change': 'تغییر رنگ‌بندی',
  'typography.change': 'تغییر تایپوگرافی',
  'brand.change': 'تغییر لوگو و برند',
  'settings.change': 'تغییر تنظیمات',
  'enamad.change': 'تغییر ای‌نماد',
  'payment_config.change': 'تغییر پیکربندی پرداخت',

  'admin.create': 'ایجاد مدیر',
  'admin.update': 'ویرایش مدیر',
  'admin.disable': 'غیرفعال‌سازی مدیر',
  'admin.permissions_change': 'تغییر دسترسی‌ها',
  'admin.login': 'ورود مدیر',
  'admin.login_failed': 'تلاش ناموفق برای ورود',

  'content.page_update': 'ویرایش صفحه',
  'content.homepage_update': 'ویرایش صفحه اصلی',
  'content.navigation_update': 'ویرایش منو و فوتر',
  'blog.publish': 'انتشار نوشته',
  'blog.update': 'ویرایش نوشته',
} as const

export type AuditAction = keyof typeof AUDIT_ACTIONS

export interface AuditEntry {
  actor: AdminPrincipal | { id: number; fullName: string } | null
  action: AuditAction
  entityType: string
  entityId?: string | number | null
  summary?: string
  metadata?: Record<string, unknown>
  ip?: string
}

export async function log(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: entry.actor?.id ?? null,
      actorName: entry.actor?.fullName ?? 'سیستم',
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId != null ? String(entry.entityId) : null,
      summary: entry.summary?.slice(0, 255) ?? AUDIT_ACTIONS[entry.action],
      metadata: entry.metadata ? (redact(entry.metadata) as object) : null,
      ip: entry.ip?.slice(0, 45) ?? null,
    })
  } catch (error) {
    console.error('Audit write failed:', error)
  }
}

export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: (keyof T)[],
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {}

  for (const field of fields) {
    if (!(field in after)) continue
    if (before[field] !== after[field]) {
      changes[String(field)] = { from: before[field], to: after[field] }
    }
  }

  return changes
}
