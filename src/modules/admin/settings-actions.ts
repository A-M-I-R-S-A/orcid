'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { smsTemplates } from '@/db/schema'
import * as audit from '@/lib/audit'
import { type ActionResult, errors, fail, ok } from '@/lib/errors'
import { clientIp } from '@/lib/rate-limit'
import { getSecret, type Namespace, setMany } from '@/lib/settings'
import { DEFAULT_THEME, isValidHex } from '@/lib/theme'
import { AVAILABLE_FONTS, findFont } from '@/lib/typography'
import { resetProvider } from '@/modules/sms/provider'
import { requirePermission } from './auth'

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

const NAMESPACE_PERMISSIONS = {
  site: 'appearance.brand',
  contact: 'settings.manage',
  social: 'settings.manage',
  shipping: 'settings.manage',
  seo: 'seo.manage',
  enamad: 'settings.enamad',
  payment_card: 'settings.payment',
  torob: 'settings.payment',
  bitpay: 'settings.payment',
  sms: 'sms.configure',
  get_later: 'settings.manage',
} as const

const SECRET_KEYS: Partial<Record<Namespace, readonly string[]>> = {
  sms: ['apiKey'],
  torob: ['clientSecret', 'password'],
  bitpay: ['apiKey'],
}

const AUDIT_ACTIONS: Partial<Record<Namespace, audit.AuditAction>> = {
  site: 'brand.change',
  enamad: 'enamad.change',
  payment_card: 'payment_config.change',
  torob: 'payment_config.change',
  bitpay: 'payment_config.change',
  sms: 'sms.config_change',
}

const ALLOWED_SETTING_KEYS: Record<Exclude<Namespace, 'theme' | 'typography'>, readonly string[]> = {
  site: ['siteName', 'tagline', 'announcementText', 'announcementHref', 'announcementEnabled', 'footerNote', 'footerShopHeading', 'footerHelpHeading', 'footerContactHeading'],
  contact: ['phone', 'email', 'address', 'workingHours'],
  social: ['instagram', 'telegram', 'whatsapp'],
  shipping: ['shippingFee', 'freeShippingThreshold', 'shippingInfo', 'returnPolicy'],
  seo: ['defaultTitle', 'defaultDescription', 'titleSeparator'],
  enamad: ['embedCode', 'metaTag'],
  payment_card: ['bankName', 'cardNumber', 'accountHolder', 'instructions', 'enabled'],
  torob: ['clientId', 'clientSecret', 'username', 'password', 'enabled'],
  bitpay: ['apiKey', 'enabled'],
  sms: ['apiKey', 'provider'],
  get_later: ['title', 'description', 'deadlineDays', 'submitLabel', 'enabled'],
}

function validPublicUrl(value: string, allowRelative = false): boolean {
  if (!value) return true
  if (allowRelative && value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

function validateSettings(namespace: Exclude<Namespace, 'theme' | 'typography'>, values: Record<string, string>) {
  const allowed = new Set(ALLOWED_SETTING_KEYS[namespace])
  if (Object.keys(values).some((key) => !allowed.has(key))) throw errors.validation('یکی از فیلدهای تنظیمات معتبر نیست.')
  if (Object.values(values).some((value) => typeof value !== 'string' || value.length > 10_000)) {
    throw errors.validation('یکی از مقادیر تنظیمات بیش از حد طولانی است.')
  }
  if (values.enabled != null && !['0', '1'].includes(values.enabled)) throw errors.validation('وضعیت فعال‌سازی معتبر نیست.')

  if (namespace === 'site') {
    if (!validPublicUrl(values.announcementHref?.trim() ?? '', true)) throw errors.validation('پیوند نوار اعلان باید با / شروع شود یا نشانی کامل HTTPS باشد.')
    if (values.announcementEnabled != null && !['0', '1'].includes(values.announcementEnabled)) throw errors.validation('وضعیت نوار اعلان معتبر نیست.')
  }
  if (namespace === 'social') {
    for (const value of Object.values(values)) {
      if (!validPublicUrl(value.trim())) throw errors.validation('نشانی شبکه اجتماعی باید کامل و با HTTPS باشد.')
    }
  }
  if (namespace === 'contact' && values.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    throw errors.validation('نشانی ایمیل معتبر نیست.')
  }
  if (namespace === 'shipping') {
    for (const key of ['shippingFee', 'freeShippingThreshold'] as const) {
      const amount = Number(values[key])
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000) {
        throw errors.validation('مبلغ ارسال باید عدد صحیحی بین صفر تا یک میلیارد تومان باشد.')
      }
    }
  }
  if (namespace === 'payment_card' && values.cardNumber?.trim() && !/^\d{16}$/.test(values.cardNumber.trim())) {
    throw errors.validation('شماره کارت باید دقیقاً ۱۶ رقم باشد.')
  }
  if (namespace === 'sms' && values.provider !== 'sms_ir') throw errors.validation('ارائه‌دهنده پیامک معتبر نیست.')
}

export async function saveSettingsAction(
  namespace: Namespace,
  values: Record<string, string>,
): Promise<ActionResult<void>> {
  try {
    const permission = NAMESPACE_PERMISSIONS[namespace as keyof typeof NAMESPACE_PERMISSIONS]
    if (!permission) throw errors.forbidden()

    validateSettings(namespace as Exclude<Namespace, 'theme' | 'typography'>, values)

    const admin = await requirePermission(permission)
    const headerList = await headers()

    const secretKeys = SECRET_KEYS[namespace] ?? []

    if (namespace === 'torob') {
      if ((values.clientId?.length ?? 0) > 500 || (values.username?.length ?? 0) > 500) {
        throw errors.validation('شناسه یا نام کاربری ترب‌پی بیش از حد طولانی است.')
      }
      if ((values.clientSecret?.length ?? 0) > 2000 || (values.password?.length ?? 0) > 2000) {
        throw errors.validation('اطلاعات محرمانه ترب‌پی بیش از حد طولانی است.')
      }
    }
    if (namespace === 'bitpay' && (values.apiKey?.length ?? 0) > 2000) {
      throw errors.validation('کلید API بیت‌پی بیش از حد طولانی است.')
    }
    if (namespace === 'get_later') {
      const days = Number(values.deadlineDays)
      if (!Number.isInteger(days) || days < 1 || days > 30) {
        throw errors.validation('مهلت پیش‌فرض باید عددی بین ۱ تا ۳۰ روز باشد.')
      }
      if ((values.title?.trim().length ?? 0) < 2 || (values.title?.length ?? 0) > 120) {
        throw errors.validation('عنوان این قابلیت باید بین ۲ تا ۱۲۰ کاراکتر باشد.')
      }
      if ((values.description?.length ?? 0) > 1000 || (values.submitLabel?.length ?? 0) > 60) {
        throw errors.validation('متن واردشده بیش از حد طولانی است.')
      }
    }

    if (namespace === 'torob' && values.enabled === '1') {
      const [savedSecret, savedPassword] = await Promise.all([
        getSecret('torob', 'clientSecret'),
        getSecret('torob', 'password'),
      ])
      if (
        !values.clientId?.trim() ||
        !(values.clientSecret?.trim() || savedSecret) ||
        !values.username?.trim() ||
        !(values.password || savedPassword)
      ) {
        throw errors.validation('برای فعال‌سازی ترب‌پی، هر چهار مشخصه دسترسی را کامل کنید.')
      }
    }

    if (namespace === 'bitpay' && values.enabled === '1') {
      const savedApiKey = await getSecret('bitpay', 'apiKey')
      if (!(values.apiKey?.trim() || savedApiKey)) {
        throw errors.validation('برای فعال‌سازی بیت‌پی، کلید API را وارد کنید.')
      }
    }

    if ((namespace === 'torob' || namespace === 'bitpay') && values.enabled === '1') {
      const appUrl = process.env.APP_URL ?? ''
      if (!appUrl.startsWith('https://')) {
        throw errors.validation('پیش از فعال‌سازی درگاه، APP_URL باید نشانی کامل HTTPS سایت باشد.')
      }
    }

    await setMany(namespace, values, secretKeys)

    if (namespace === 'sms') resetProvider()

    await audit.log({
      actor: admin,
      action: AUDIT_ACTIONS[namespace] ?? 'settings.change',
      entityType: 'settings',
      entityId: namespace,
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
