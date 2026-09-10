import { z } from 'zod'

import { MAX_AMOUNT } from './money'
import { normalizePhone, normalizePostalCode, toLatinDigits } from './persian'

export const phoneSchema = z
  .string({ required_error: 'شماره موبایل الزامی است.' })
  .trim()
  .transform((v) => normalizePhone(v))
  .refine((v): v is string => v !== null, { message: 'شماره موبایل معتبر نیست.' })

export const otpCodeSchema = z
  .string({ required_error: 'کد تأیید را وارد کنید.' })
  .trim()
  .transform(toLatinDigits)
  .pipe(
    z
      .string()
      .regex(/^\d{6}$/, { message: 'کد تأیید باید ۶ رقم باشد.' }),
  )

export const postalCodeSchema = z
  .string({ required_error: 'کد پستی الزامی است.' })
  .trim()
  .transform((v) => normalizePostalCode(v))
  .refine((v): v is string => v !== null, { message: 'کد پستی باید ۱۰ رقم باشد.' })

export const nameSchema = z
  .string({ required_error: 'نام و نام خانوادگی الزامی است.' })
  .trim()
  .min(3, { message: 'نام و نام خانوادگی باید حداقل ۳ کاراکتر باشد.' })
  .max(120, { message: 'نام و نام خانوادگی طولانی است.' })

export const passwordSchema = z
  .string({ required_error: 'رمز عبور الزامی است.' })
  .min(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' })
  .max(200, { message: 'رمز عبور طولانی است.' })

export const amountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => Number(toLatinDigits(String(v)).replace(/[,٬\s]/g, '')))
  .pipe(
    z
      .number({ invalid_type_error: 'مبلغ معتبر نیست.' })
      .int({ message: 'مبلغ باید عدد صحیح باشد.' })
      .min(0, { message: 'مبلغ نمی‌تواند منفی باشد.' })
      .max(MAX_AMOUNT, { message: 'مبلغ بیش از حد مجاز است.' }),
  )

export const quantitySchema = z
  .union([z.string(), z.number()])
  .transform((v) => Number(toLatinDigits(String(v))))
  .pipe(
    z
      .number({ invalid_type_error: 'تعداد معتبر نیست.' })
      .int({ message: 'تعداد باید عدد صحیح باشد.' })
      .min(1, { message: 'حداقل تعداد ۱ عدد است.' })
      .max(99, { message: 'حداکثر تعداد مجاز ۹۹ عدد است.' }),
  )

export const idSchema = z
  .union([z.string(), z.number()])
  .transform((v) => Number(toLatinDigits(String(v))))
  .pipe(z.number().int().positive({ message: 'شناسه معتبر نیست.' }))

export const slugSchema = z
  .string()
  .trim()
  .min(1, { message: 'نشانی صفحه الزامی است.' })
  .max(180, { message: 'نشانی صفحه طولانی است.' })

export const otpPurposeSchema = z.enum(['login', 'register', 'password_reset'])

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  purpose: otpPurposeSchema.default('login'),
})

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
})

export const registerSchema = z.object({
  fullName: nameSchema,
  phone: phoneSchema,
  password: passwordSchema,
})

export const passwordLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string({ required_error: 'رمز عبور الزامی است.' }).min(1).max(200),
})

export const resetPasswordSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
  password: passwordSchema,
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(200).optional().or(z.literal('')),
  password: passwordSchema,
})

export const adminLoginSchema = z.object({
  username: z
    .string({ required_error: 'نام کاربری الزامی است.' })
    .trim()
    .min(3, { message: 'نام کاربری معتبر نیست.' })
    .max(60),
  password: z
    .string({ required_error: 'رمز عبور الزامی است.' })
    .min(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' })
    .max(200),
})

export const profileSchema = z.object({
  fullName: nameSchema,
  email: z
    .string()
    .trim()
    .email({ message: 'ایمیل معتبر نیست.' })
    .max(190)
    .optional()
    .or(z.literal('')),
})

export const addressSchema = z.object({
  fullName: nameSchema,
  phone: phoneSchema,
  province: z
    .string({ required_error: 'استان الزامی است.' })
    .trim()
    .min(2, { message: 'استان را انتخاب کنید.' })
    .max(60),
  city: z
    .string({ required_error: 'شهر الزامی است.' })
    .trim()
    .min(2, { message: 'شهر را وارد کنید.' })
    .max(80),
  addressLine: z
    .string({ required_error: 'نشانی الزامی است.' })
    .trim()
    .min(10, { message: 'نشانی را کامل وارد کنید.' })
    .max(500),
  postalCode: postalCodeSchema,
  notes: z.string().trim().max(500).optional().or(z.literal('')),
})

export const addToCartSchema = z.object({
  variantId: idSchema,
  quantity: quantitySchema.default(1),
})

export const updateCartItemSchema = z.object({
  itemId: idSchema,
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => Number(toLatinDigits(String(v))))
    .pipe(z.number().int().min(0).max(99)),
})

export const checkoutSchema = z.object({
  fullName: nameSchema,
  phone: phoneSchema,
  province: z.string().trim().min(2, { message: 'استان را انتخاب کنید.' }).max(60),
  city: z.string().trim().min(2, { message: 'شهر را وارد کنید.' }).max(80),
  addressLine: z.string().trim().min(10, { message: 'نشانی را کامل وارد کنید.' }).max(500),
  postalCode: postalCodeSchema,
  customerNote: z.string().trim().max(500).optional().or(z.literal('')),
  paymentMethod: z.enum(['card_to_card', 'torob_pay', 'bitpay'], {
    errorMap: () => ({ message: 'روش پرداخت را انتخاب کنید.' }),
  }),
})

export const paymentReferenceSchema = z.object({
  orderId: idSchema,
  referenceCode: z
    .string({ required_error: 'کد رهگیری پرداخت را وارد کنید.' })
    .trim()
    .transform(toLatinDigits)
    .pipe(
      z
        .string()
        .min(4, { message: 'کد رهگیری باید حداقل ۴ کاراکتر باشد.' })
        .max(64, { message: 'کد رهگیری طولانی است.' })
        .regex(/^[A-Za-z0-9-]+$/, {
          message: 'کد رهگیری تنها می‌تواند شامل حروف و اعداد باشد.',
        }),
    ),
})

export const reviewSchema = z.object({
  productId: idSchema,
  rating: z
    .union([z.string(), z.number()])
    .transform((v) => Number(toLatinDigits(String(v))))
    .pipe(
      z
        .number()
        .int()
        .min(1, { message: 'امتیاز را انتخاب کنید.' })
        .max(5, { message: 'امتیاز نامعتبر است.' }),
    ),
  title: z.string().trim().max(160).optional().or(z.literal('')),
  body: z
    .string({ required_error: 'متن دیدگاه الزامی است.' })
    .trim()
    .min(10, { message: 'متن دیدگاه باید حداقل ۱۰ کاراکتر باشد.' })
    .max(2000, { message: 'متن دیدگاه طولانی است.' }),
})

export const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular']).default('newest'),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  color: z.string().trim().max(80).optional(),
  size: z.string().trim().max(80).optional(),
  inStock: z.coerce.boolean().optional(),
})

export type SearchParams = z.infer<typeof searchParamsSchema>

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (!out[key]) out[key] = issue.message
  }
  return out
}

export async function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): Promise<z.infer<T>> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const { errors } = await import('./errors')
    throw errors.validation(undefined, fieldErrors(result.error))
  }
  return result.data
}

export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue
    if (key in out) {
      const existing = out[key]
      out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
    } else {
      out[key] = value
    }
  }
  return out
}

export const navHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (value) => value.startsWith('/') || /^https:\/\//i.test(value),
    'پیوند باید با / شروع شود یا یک نشانی https باشد.',
  )
  .refine((value) => !value.startsWith('//'), 'پیوند معتبر نیست.')

export const navLinkSchema = z.object({
  label: z.string().trim().min(1, 'عنوان الزامی است.').max(60),
  href: navHrefSchema,
})
