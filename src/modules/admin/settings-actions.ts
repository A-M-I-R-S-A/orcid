'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { smsTemplates } from '@/db/schema'
import * as audit from '@/lib/audit'
import { type ActionResult, errors, fail, ok } from '@/lib/errors'
import { clientIp } from '@/lib/rate-limit'
import { type Namespace, setMany } from '@/lib/settings'
import { DEFAULT_THEME, isValidHex } from '@/lib/theme'
import { AVAILABLE_FONTS, findFont } from '@/lib/typography'
import { resetProvider } from '@/modules/sms/provider'
import { requirePermission } from './auth'

/**
 * Settings mutations. §48 / §49 / §51 / §52.
 *
 * Two rules run through all of these:
 *
 *  1. Values are VALIDATED before they are stored. A malformed hex or an
 *     unknown font key would otherwise emit broken CSS into every page — the
 *     theme is inlined into <head>, so bad data there breaks the whole site,
 *     not one screen.
 *
 *  2. Secrets pass `secretKeys` to `setMany`, which encrypts them and treats a
 *     BLANK value as "leave unchanged". The admin form shows a mask, so an
 *     untouched field must not wipe a working credential.
 */

/* ── Theme ──────────────────────────────────────────────────────────────── */

export async function saveThemeAction(
  input: Record<string, string>,
): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('appearance.theme')
    const headerList = await headers()

    const values: Record<string, string> = {}
    const invalid: string[] = []

    for (const key of Object.keys(DEFAULT_THEME)) {
      const value = input[key]
      if (!value) continue

      if (!isValidHex(value)) {
        invalid.push(key)
        continue
      }
      values[key] = value
    }

    if (invalid.length > 0) {
      throw errors.validation('کد رنگ وارد شده معتبر نیست. قالب صحیح: #RRGGBB')
    }

    await setMany('theme', values)

    await audit.log({
      actor: admin,
      action: 'theme.change',
      entityType: 'settings',
      entityId: 'theme',
      metadata: values,
      ip: clientIp(headerList),
    })

    // The theme is inlined into every page's <head>, so every page is stale.
    revalidatePath('/', 'layout')

    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'saveTheme' })
  }
}

export async function resetThemeAction(): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('appearance.theme')
    await setMany('theme', { ...DEFAULT_THEME })

    await audit.log({
      actor: admin,
      action: 'theme.change',
      entityType: 'settings',
      entityId: 'theme',
      summary: 'بازگردانی رنگ‌بندی پیش‌فرض',
    })

    revalidatePath('/', 'layout')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'resetTheme' })
  }
}

/* ── Typography ─────────────────────────────────────────────────────────── */

export async function saveTypographyAction(input: {
  headingFont: string
  bodyFont: string
  baseSize: string
  scale: string
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('appearance.typography')

    const heading = findFont(input.headingFont)
    const body = findFont(input.bodyFont)

    if (!heading) throw errors.validation('فونت عنوان انتخاب‌شده معتبر نیست.')
    if (!body) throw errors.validation('فونت متن انتخاب‌شده معتبر نیست.')

    // §8: a display-only face cannot carry body copy. Enforced here as well as
    // in the UI, so a crafted request cannot make the site unreadable.
    if (!body.bodyEligible) {
      throw errors.validation(
        `فونت «${body.label}» تنها برای عناوین مناسب است و نمی‌تواند فونت متن باشد.`,
      )
    }

    const baseSize = Number(input.baseSize)
    if (!Number.isFinite(baseSize) || baseSize < 14 || baseSize > 20) {
      throw errors.validation('اندازه پایه متن باید بین ۱۴ تا ۲۰ پیکسل باشد.')
    }

    if (!['compact', 'default', 'spacious'].includes(input.scale)) {
      throw errors.validation('مقیاس تایپوگرافی معتبر نیست.')
    }

    await setMany('typography', {
      headingFont: heading.key,
      bodyFont: body.key,
      baseSize: String(baseSize),
      scale: input.scale,
    })

    await audit.log({
      actor: admin,
      action: 'typography.change',
      entityType: 'settings',
      entityId: 'typography',
      metadata: { headingFont: heading.key, bodyFont: body.key },
    })

    revalidatePath('/', 'layout')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'saveTypography' })
  }
}

/* ── Generic namespace save ─────────────────────────────────────────────── */

const NAMESPACE_PERMISSIONS = {
  site: 'appearance.brand',
  contact: 'settings.manage',
  social: 'settings.manage',
  shipping: 'settings.manage',
  seo: 'seo.manage',
  enamad: 'settings.enamad',
  payment_card: 'settings.payment',
  torob: 'settings.payment',
  sms: 'sms.configure',
} as const

const SECRET_KEYS: Partial<Record<Namespace, readonly string[]>> = {
  sms: ['apiKey'],
  torob: ['apiKey', 'accessCode'],
}

const AUDIT_ACTIONS: Partial<Record<Namespace, audit.AuditAction>> = {
  site: 'brand.change',
  enamad: 'enamad.change',
  payment_card: 'payment_config.change',
  torob: 'payment_config.change',
  sms: 'sms.config_change',
}

export async function saveSettingsAction(
  namespace: Namespace,
  values: Record<string, string>,
): Promise<ActionResult<void>> {
  try {
    const permission = NAMESPACE_PERMISSIONS[namespace as keyof typeof NAMESPACE_PERMISSIONS]
    if (!permission) throw errors.forbidden()

    const admin = await requirePermission(permission)
    const headerList = await headers()

    const secretKeys = SECRET_KEYS[namespace] ?? []
    await setMany(namespace, values, secretKeys)

    // Credentials changed — drop the memoised provider so the next send picks
    // up the new key rather than the old one.
    if (namespace === 'sms') resetProvider()

    await audit.log({
      actor: admin,
      action: AUDIT_ACTIONS[namespace] ?? 'settings.change',
      entityType: 'settings',
      entityId: namespace,
      // Secret VALUES never reach the audit log — only which keys were touched.
      metadata: {
        keys: Object.keys(values).filter((k) => !secretKeys.includes(k)),
        secretsUpdated: Object.keys(values).filter(
          (k) => secretKeys.includes(k) && Boolean(values[k]),
        ),
      },
      ip: clientIp(headerList),
    })

    revalidatePath('/', 'layout')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'saveSettings', namespace })
  }
}

/* ── SMS templates ──────────────────────────────────────────────────────── */

export async function saveSmsTemplateAction(input: {
  id: number
  providerTemplateId: string
  isEnabled: boolean
  requiresApproval: boolean
}): Promise<ActionResult<void>> {
  try {
    const admin = await requirePermission('sms.configure')
    const headerList = await headers()

    await db
      .update(smsTemplates)
      .set({
        providerTemplateId: input.providerTemplateId.trim() || null,
        isEnabled: input.isEnabled,
        requiresApproval: input.requiresApproval,
      })
      .where(eq(smsTemplates.id, input.id))

    await audit.log({
      actor: admin,
      action: 'sms.template_change',
      entityType: 'sms_template',
      entityId: input.id,
      metadata: {
        enabled: input.isEnabled,
        requiresApproval: input.requiresApproval,
      },
      ip: clientIp(headerList),
    })

    revalidatePath('/admin/sms')
    return ok(undefined)
  } catch (error) {
    return fail(error, { action: 'saveSmsTemplate', templateId: input.id })
  }
}

export async function availableFontsAction(): Promise<ActionResult<typeof AVAILABLE_FONTS>> {
  return ok(AVAILABLE_FONTS)
}
