import 'server-only'

import { z } from 'zod'

import { errors } from '@/lib/errors'
import { assertAmount } from '@/lib/money'
import { getNamespace, getSecret } from '@/lib/settings'

const TOROB_BASE = 'https://cpg.torobpay.com/'
const BITPAY_BASE = 'https://bitpay.ir/payment/'
const REQUEST_TIMEOUT_MS = 12_000

export interface TorobCredentials {
  clientId: string
  clientSecret: string
  username: string
  password: string
}

export function toRial(toman: number): number {
  const amount = assertAmount(toman)
  const rial = amount * 10
  if (!Number.isSafeInteger(rial)) throw errors.payment('مبلغ سفارش برای درگاه معتبر نیست.')
  return rial
}

async function requestText(url: string, init: RequestInit): Promise<string> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Gateway returned HTTP ${response.status}`)
    return await response.text()
  } catch {
    throw errors.payment(
      'ارتباط با درگاه انجام نشد. وضعیت پرداخت را دوباره بررسی کنید و در صورت کسر وجه با پشتیبانی تماس بگیرید.',
    )
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    throw errors.payment('پاسخ درگاه معتبر نبود. لطفاً دوباره تلاش کنید.')
  }
}

export async function getTorobCredentials(): Promise<TorobCredentials> {
  const [settings, clientSecret, password] = await Promise.all([
    getNamespace('torob'),
    getSecret('torob', 'clientSecret'),
    getSecret('torob', 'password'),
  ])
  return {
    clientId: settings.clientId?.trim() ?? '',
    clientSecret,
    username: settings.username?.trim() ?? '',
    password,
  }
}

export function torobConfigured(credentials: TorobCredentials): boolean {
  return Boolean(
    credentials.clientId &&
      credentials.clientSecret &&
      credentials.username &&
      credentials.password,
  )
}

export async function torobRequest(
  credentials: TorobCredentials,
  path: string,
  data: Record<string, unknown>,
  method: 'GET' | 'POST' = 'POST',
): Promise<Record<string, unknown>> {
  const authRaw = await requestText(new URL('api/online/v1/oauth/token', TOROB_BASE).toString(), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      scope: 'online-merchant',
      username: credentials.username,
      password: credentials.password,
    }),
  })

  const auth = z.object({ access_token: z.string().min(1) }).safeParse(parseJson(authRaw))
  if (!auth.success) throw errors.payment('احراز هویت ترب‌پی انجام نشد.')

  const url = new URL(`api/online/${path}`, TOROB_BASE)
  if (method === 'GET') {
    for (const [key, value] of Object.entries(data)) url.searchParams.set(key, String(value))
  }

  const raw = await requestText(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${auth.data.access_token}`,
      'Content-Type': 'application/json',
    },
    ...(method === 'POST' ? { body: JSON.stringify(data) } : {}),
  })

  const result = z
    .object({ successful: z.literal(true), response: z.record(z.unknown()).nullish() })
    .safeParse(parseJson(raw))
  if (!result.success) throw errors.payment('ترب‌پی درخواست را نپذیرفت.')
  return result.data.response ?? {}
}

export async function assertTorobEligible(amountToman: number): Promise<void> {
  const credentials = await getTorobCredentials()
  if (!torobConfigured(credentials)) throw errors.payment('درگاه ترب‌پی پیکربندی نشده است.')
  const response = await torobRequest(
    credentials,
    'offer/v1/eligible',
    { amount: toRial(amountToman) },
    'GET',
  )
  if (response.eligible !== true) {
    throw errors.payment('پرداخت ترب‌پی برای مبلغ این سفارش در دسترس نیست.')
  }
}

export async function bitpayRequest(
  action: 'gateway-send' | 'gateway-result-second',
  data: Record<string, string>,
): Promise<string> {
  const apiKey = await getSecret('bitpay', 'apiKey')
  if (!apiKey) throw errors.payment('درگاه بیت‌پی پیکربندی نشده است.')
  return requestText(new URL(action, BITPAY_BASE).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...data, api: apiKey }),
  })
}

export function verifyBitpayResponse(raw: string, amountRial: number, factorId: string): boolean {
  const parsed = z
    .object({
      status: z.union([z.number(), z.string()]),
      amount: z.union([z.number(), z.string()]),
      factorId: z.union([z.number(), z.string()]),
    })
    .safeParse(parseJson(raw))

  return (
    parsed.success &&
    [1, 11].includes(Number(parsed.data.status)) &&
    Number(parsed.data.amount) === amountRial &&
    String(parsed.data.factorId) === factorId
  )
}

export function safeTorobRedirect(value: unknown): string {
  if (typeof value !== 'string') throw errors.payment('نشانی بازگشتی ترب‌پی معتبر نیست.')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw errors.payment('نشانی بازگشتی ترب‌پی معتبر نیست.')
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !(url.hostname === 'torobpay.com' || url.hostname.endsWith('.torobpay.com'))
  ) {
    throw errors.payment('نشانی بازگشتی ترب‌پی معتبر نیست.')
  }
  return url.toString()
}
