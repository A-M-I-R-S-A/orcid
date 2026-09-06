import 'server-only'

import { getSecret, getSetting } from '@/lib/settings'

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
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
  getCredit(): Promise<number | null>
}

const SMS_IR_BASE = 'https://api.sms.ir/v1'
const TIMEOUT_MS = 15_000

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
          retryable: response.status >= 500 || response.status === 429,
        }
      }

      let body: { status?: number; message?: string; data?: { messageId?: number | string } }
      try {
        body = JSON.parse(text)
      } catch {
        return { success: false, error: scrub(`Malformed response: ${text}`), retryable: true }
      }

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

export function resetProvider(): void {
  cached = undefined
}
