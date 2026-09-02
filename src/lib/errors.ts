import { randomUUID } from 'node:crypto'

/**
 * Error handling.
 *
 * §82: customers see Persian, clear and non-technical. Stack traces, SQL text,
 * internal paths and upstream API bodies never reach the browser — they go to
 * the server log under a correlation id the customer can quote to support.
 */

export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'OUT_OF_STOCK'
  | 'PAYMENT'
  | 'SMS'
  | 'INTERNAL'

/** An error whose message is safe to show a customer, in Persian. */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly fieldErrors?: Record<string, string>
  readonly correlationId: string

  constructor(
    code: ErrorCode,
    /** Persian, customer-facing. */
    message: string,
    options?: { status?: number; fieldErrors?: Record<string, string>; cause?: unknown },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'AppError'
    this.code = code
    this.status = options?.status ?? defaultStatus(code)
    this.fieldErrors = options?.fieldErrors
    this.correlationId = randomUUID().slice(0, 8)
  }
}

function defaultStatus(code: ErrorCode): number {
  switch (code) {
    case 'VALIDATION':
      return 400
    case 'UNAUTHENTICATED':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'CONFLICT':
    case 'OUT_OF_STOCK':
      return 409
    case 'RATE_LIMITED':
      return 429
    default:
      return 500
  }
}

/* ── Persian messages ───────────────────────────────────────────────────── */

export const MESSAGES = {
  generic: 'خطایی رخ داد. لطفاً دوباره تلاش کنید.',
  validation: 'اطلاعات وارد شده معتبر نیست.',
  unauthenticated: 'برای ادامه وارد حساب کاربری خود شوید.',
  forbidden: 'شما به این بخش دسترسی ندارید.',
  notFound: 'مورد درخواستی یافت نشد.',
  rateLimited: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',

  // Authentication
  invalidPhone: 'شماره موبایل معتبر نیست.',
  otpInvalid: 'کد وارد شده صحیح نیست یا منقضی شده است.',
  otpTooMany: 'تعداد تلاش‌های ناموفق بیش از حد مجاز است. کد جدیدی درخواست کنید.',
  otpCooldown: 'برای درخواست کد جدید کمی صبر کنید.',
  accountDisabled: 'حساب کاربری شما غیرفعال است. با پشتیبانی تماس بگیرید.',

  // Cart & checkout
  productUnavailable: 'این محصول در حال حاضر موجود نیست.',
  variantUnavailable: 'این تنوع از محصول در دسترس نیست.',
  insufficientStock: 'موجودی این محصول کافی نیست.',
  cartEmpty: 'سبد خرید شما خالی است.',
  priceChanged: 'قیمت برخی از اقلام سبد خرید تغییر کرده است. لطفاً سبد خرید را بررسی کنید.',

  // Payment
  paymentMethodUnavailable: 'این روش پرداخت در حال حاضر فعال نیست.',
  referenceRequired: 'کد رهگیری پرداخت را وارد کنید.',
  referenceDuplicate: 'این کد رهگیری قبلاً ثبت شده است.',
  orderNotPayable: 'این سفارش در وضعیت قابل پرداخت نیست.',

  // Reviews
  reviewNotOwned: 'شما اجازه ویرایش این دیدگاه را ندارید.',
  reviewDuplicate: 'شما قبلاً برای این محصول دیدگاه ثبت کرده‌اید.',

  // Uploads
  fileTooLarge: 'حجم فایل بیش از حد مجاز است.',
  fileTypeInvalid: 'فرمت فایل مجاز نیست. تنها تصاویر JPG، PNG و WebP پذیرفته می‌شوند.',
  fileCorrupt: 'فایل تصویر معتبر نیست.',
} as const

/* ── Constructors ───────────────────────────────────────────────────────── */

export const errors = {
  validation: (message: string = MESSAGES.validation, fieldErrors?: Record<string, string>) =>
    new AppError('VALIDATION', message, { fieldErrors }),
  unauthenticated: (message: string = MESSAGES.unauthenticated) =>
    new AppError('UNAUTHENTICATED', message),
  forbidden: (message: string = MESSAGES.forbidden) => new AppError('FORBIDDEN', message),
  notFound: (message: string = MESSAGES.notFound) => new AppError('NOT_FOUND', message),
  conflict: (message: string) => new AppError('CONFLICT', message),
  rateLimited: (message: string = MESSAGES.rateLimited) => new AppError('RATE_LIMITED', message),
  outOfStock: (message: string = MESSAGES.insufficientStock) =>
    new AppError('OUT_OF_STOCK', message),
  payment: (message: string) => new AppError('PAYMENT', message),
  internal: (cause?: unknown) => new AppError('INTERNAL', MESSAGES.generic, { cause }),
}

/* ── Logging ────────────────────────────────────────────────────────────── */

const REDACT_KEYS = /(password|token|secret|apikey|api_key|authorization|otp|code|cookie)/i

/**
 * Removes anything that must never appear in a log line. Applied to every
 * context object before it is written. §58: never log secrets or OTP codes.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]'
  if (value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1)
  }
  return out
}

/**
 * Logs the technical detail server-side and returns the customer-safe shape.
 * Callers render `message`; `correlationId` is what support asks for.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): { message: string; code: ErrorCode; correlationId: string; fieldErrors?: Record<string, string> } {
  if (error instanceof AppError) {
    // Expected, customer-facing conditions are noise at error level.
    if (error.code === 'INTERNAL') {
      console.error(
        `[${error.correlationId}] ${error.code}:`,
        error.cause ?? error.message,
        redact(context),
      )
    }
    return {
      message: error.message,
      code: error.code,
      correlationId: error.correlationId,
      fieldErrors: error.fieldErrors,
    }
  }

  const wrapped = errors.internal(error)
  console.error(`[${wrapped.correlationId}] UNHANDLED:`, error, redact(context))
  return {
    message: wrapped.message,
    code: 'INTERNAL',
    correlationId: wrapped.correlationId,
  }
}

/* ── Server action results ──────────────────────────────────────────────── */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode; correlationId: string; fieldErrors?: Record<string, string> }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail(error: unknown, context?: Record<string, unknown>): ActionResult<never> {
  const reported = reportError(error, context)
  return {
    ok: false,
    error: reported.message,
    code: reported.code,
    correlationId: reported.correlationId,
    fieldErrors: reported.fieldErrors,
  }
}
