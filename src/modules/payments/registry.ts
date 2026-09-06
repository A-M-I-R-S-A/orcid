import 'server-only'

import { getBool, getNamespace, getSecret } from '@/lib/settings'

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
    const apiKey = await getSecret('torob', 'apiKey')
    const accessCode = await getSecret('torob', 'accessCode')
    return Boolean(apiKey && accessCode)
  }

  async initiate(): Promise<InitiateResult> {
    throw new Error(
      'Torob Pay adapter is not implemented. Verify the provider API contract, ' +
        'implement initiate() and the callback route, then enable it in the admin panel.',
    )
  }
}

const PROVIDERS: PaymentProvider[] = [new CardToCardProvider(), new TorobPayProvider()]

export function getProvider(key: string): PaymentProvider | undefined {
  return PROVIDERS.find((p) => p.key === key)
}

export function allProviders(): PaymentProvider[] {
  return PROVIDERS
}

export async function getEnabledMethods(): Promise<PaymentMethodInfo[]> {
  const results = await Promise.all(
    PROVIDERS.map(async (provider) => {
      const [enabled, configured] = await Promise.all([
        provider.isEnabled(),
        provider.isConfigured(),
      ])
      return enabled && configured ? provider.info : null
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
