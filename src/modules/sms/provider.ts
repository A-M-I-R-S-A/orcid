import 'server-only'

import { getSecret, getSetting } from '@/lib/settings'

/**
 * SMS provider abstraction.
 *
 * SMS.ir is the first implementation, but every caller goes through this
 * interface. If the provider's payload shape differs from what is coded here,
 * the change costs one file rather than a rewrite.
 *
 * ── A note on the endpoint details ─────────────────────────────────────────
 * The request shapes below follow SMS.ir's documented v1 REST API (an API key
 * in the `x-api-key` header, template sends with named parameters). They MUST
 * be checked against the provider's current documentation before go-live —
 * this is the one place in the codebase where correctness depends on a
 * third-party contract rather than on our own code. `verifyConfiguration`
 * exists so that check is a button in the admin panel, not a guess.
 */

export interface SendResult {
  success: boolean
  /** Provider-side id, stored for support enquiries. */
  messageId?: string
  /** Scrubbed of credentials before it is ever persisted or logged. */
  error?: string
  /** True when retrying could plausibly succeed (timeout, 5xx). */
  retryable?: boolean
}

export interface SmsProvider {
  readonly key: string
  isConfigured(): Promise<boolean>
  sendTemplate(
    phone: string,
    templateId: string,
    parameters: Record<string, string>,
  ): Promise<SendResult>
  /** Remaining credit, when the provider exposes it. Null when unsupported. */
  getCredit(): Promise<number | null>
}

const SMS_IR_BASE = 'https://api.sms.ir/v1'
const TIMEOUT_MS = 15_000

/**
 * Strips anything credential-shaped from a provider response before it is
 * stored or logged. §58 — an error string from an upstream API is exactly the
 * kind of value that quietly carries a key into the database.
 */
function scrub(message: string): string {
  return message
    .replace(/[A-Za-z0-9_-]{25,}/g, '[redacted]')
    .slice(0, 240)
}

class SmsIrProvider implements SmsProvider {
  readonly key = 'sms_ir'

  private async apiKey(): Promise<string> {
    return getSecret('sms', 'apiKey')
  }

  async isConfigured(): Promise<boolean> {
    return Boolean(await this.apiKey())
  }

  async sendTemplate(
    phone: string,
    templateId: string,
    parameters: Record<string, string>,
  ): Promise<SendResult> {
    const apiKey = await this.apiKey()
    if (!apiKey) {
      return { success: false, error: 'سرویس پیامک پیکربندی نشده است.', retryable: false }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(`${SMS_IR_BASE}/send/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          mobile: phone,
          templateId: Number(templateId),
          parameters: Object.entries(parameters).map(([name, value]) => ({
            name,
            value: String(value),
          })),
        }),
        signal: controller.signal,
      })

      const text = await response.text()

      if (!response.ok) {
        return {
          success: false,
          error: scrub(`HTTP ${response.status}: ${text}`),
          // 4xx is our fault and will fail identically on retry; 5xx may not.
          retryable: response.status >= 500 || response.status === 429,
        }
      }

      let body: { status?: number; message?: string; data?: { messageId?: number | string } }
      try {
        body = JSON.parse(text)
      } catch {
        return { success: false, error: scrub(`Malformed response: ${text}`), retryable: true }
      }

      // SMS.ir signals application-level success with status 1.
      if (body.status !== 1) {
        return {
          success: false,
          error: scrub(body.message ?? 'ارسال پیامک ناموفق بود.'),
          retryable: false,
        }
      }

      return { success: true, messageId: body.data?.messageId ? String(body.data.messageId) : undefined }
    } catch (error) {
      const isAbort = (error as Error).name === 'AbortError'
      return {
        success: false,
        error: isAbort ? 'اتصال به سرویس پیامک زمان‌بر شد.' : scrub(String(error)),
        retryable: true,
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async getCredit(): Promise<number | null> {
    const apiKey = await this.apiKey()
    if (!apiKey) return null

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(`${SMS_IR_BASE}/credit`, {
        headers: { Accept: 'application/json', 'x-api-key': apiKey },
        signal: controller.signal,
      })
      if (!response.ok) return null

      const body = (await response.json()) as { status?: number; data?: number }
      return body.status === 1 && typeof body.data === 'number' ? body.data : null
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * A provider that records what it would have sent, for development and for the
 * period before real credentials arrive.
 *
 * It deliberately does NOT print the OTP parameters — §24 forbids logging the
 * code, and a development convenience that violates that would eventually ship.
 */
class NullProvider implements SmsProvider {
  readonly key = 'null'

  async isConfigured(): Promise<boolean> {
    return true
  }

  async sendTemplate(phone: string, templateId: string): Promise<SendResult> {
    console.info(`[sms:null] would send template ${templateId} to ${phone.slice(0, 4)}***`)
    return { success: true, messageId: `null-${Date.now()}` }
  }

  async getCredit(): Promise<number | null> {
    return null
  }
}

let cached: SmsProvider | undefined

export async function getProvider(): Promise<SmsProvider> {
  const configured = await getSetting('sms', 'provider', 'sms_ir')

  if (configured === 'null' || process.env.SMS_DRIVER === 'null') {
    return new NullProvider()
  }

  cached ??= new SmsIrProvider()
  return cached
}

/** Clears the memoised provider after a credential change. */
export function resetProvider(): void {
  cached = undefined
}
