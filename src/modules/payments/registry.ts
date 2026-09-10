import 'server-only'

import { getBool, getNamespace, getSecret } from '@/lib/settings'
import { assertTorobEligible, getTorobCredentials, torobConfigured } from './gateway-client'
import { startGatewayPayment } from './gateway-service'

export interface PaymentMethodInfo {
  key: string
  label: string
  description: string
  kind: 'manual' | 'gateway'
}

export type InitiateResult =
  | {
      kind: 'instructions'
      instructions: {
        bankName: string
        cardNumber: string
        accountHolder: string
        note: string
      }
    }
  | { kind: 'redirect'; url: string }

export interface PaymentProvider {
  readonly key: string
  readonly info: PaymentMethodInfo
  isEnabled(): Promise<boolean>
  isConfigured(): Promise<boolean>
  isAvailable?(amount: number): Promise<boolean>
  initiate(order: { id: number; orderNumber: string; amount: number }): Promise<InitiateResult>
}

class CardToCardProvider implements PaymentProvider {
  readonly key = 'card_to_card'

  readonly info: PaymentMethodInfo = {
    key: 'card_to_card',
    label: 'پرداخت کارت به کارت',
    description: 'مبلغ سفارش را به شماره کارت اعلام‌شده واریز کرده و کد رهگیری را ثبت کنید.',
    kind: 'manual',
  }

  async isEnabled(): Promise<boolean> {
    return getBool('payment_card', 'enabled', true)
  }

  async isConfigured(): Promise<boolean> {
    const settings = await getNamespace('payment_card')
    return Boolean(settings.cardNumber && settings.accountHolder)
  }

  async initiate(): Promise<InitiateResult> {
    const settings = await getNamespace('payment_card')

    return {
      kind: 'instructions',
      instructions: {
        bankName: settings.bankName ?? '',
        cardNumber: settings.cardNumber ?? '',
        accountHolder: settings.accountHolder ?? '',
        note: settings.instructions ?? '',
      },
    }
  }
}

class TorobPayProvider implements PaymentProvider {
  readonly key = 'torob_pay'

  readonly info: PaymentMethodInfo = {
    key: 'torob_pay',
    label: 'پرداخت با ترب‌پی',
    description: 'پرداخت آنلاین از طریق درگاه ترب‌پی.',
    kind: 'gateway',
  }

  async isEnabled(): Promise<boolean> {
    return getBool('torob', 'enabled', false)
  }

  async isConfigured(): Promise<boolean> {
    return torobConfigured(await getTorobCredentials())
  }

  async isAvailable(amount: number): Promise<boolean> {
    try {
      await assertTorobEligible(amount)
      return true
    } catch {
      return false
    }
  }

  async initiate(order: { id: number; orderNumber: string; amount: number }): Promise<InitiateResult> {
    return { kind: 'redirect', url: await startGatewayPayment('torob_pay', order) }
  }
}

class BitPayProvider implements PaymentProvider {
  readonly key = 'bitpay'

  readonly info: PaymentMethodInfo = {
    key: 'bitpay',
    label: 'پرداخت آنلاین با بیت‌پی',
    description: 'پرداخت امن با کارت‌های بانکی عضو شتاب از طریق بیت‌پی.',
    kind: 'gateway',
  }

  async isEnabled(): Promise<boolean> {
    return getBool('bitpay', 'enabled', false)
  }

  async isConfigured(): Promise<boolean> {
    return Boolean(await getSecret('bitpay', 'apiKey'))
  }

  async initiate(order: { id: number; orderNumber: string; amount: number }): Promise<InitiateResult> {
    return { kind: 'redirect', url: await startGatewayPayment('bitpay', order) }
  }
}

const PROVIDERS: PaymentProvider[] = [
  new CardToCardProvider(),
  new TorobPayProvider(),
  new BitPayProvider(),
]

export function getProvider(key: string): PaymentProvider | undefined {
  return PROVIDERS.find((p) => p.key === key)
}

export function allProviders(): PaymentProvider[] {
  return PROVIDERS
}

export async function getEnabledMethods(options: { amount?: number } = {}): Promise<PaymentMethodInfo[]> {
  const results = await Promise.all(
    PROVIDERS.map(async (provider) => {
      const [enabled, configured] = await Promise.all([
        provider.isEnabled(),
        provider.isConfigured(),
      ])
      if (!enabled || !configured) return null
      if (options.amount != null && provider.isAvailable) {
        return (await provider.isAvailable(options.amount)) ? provider.info : null
      }
      return provider.info
    }),
  )

  return results.filter((info): info is PaymentMethodInfo => info !== null)
}

export async function providerStatuses() {
  return Promise.all(
    PROVIDERS.map(async (provider) => ({
      key: provider.key,
      label: provider.info.label,
      kind: provider.info.kind,
      enabled: await provider.isEnabled(),
      configured: await provider.isConfigured(),
    })),
  )
}
