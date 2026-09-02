import 'server-only'

import { getBool, getNamespace, getSecret } from '@/lib/settings'

/**
 * Payment provider registry. §28 / §32.
 *
 * Both methods implement one interface, so activating Torob Pay later is
 * registering an adapter — not reworking checkout. Checkout branches on the
 * SHAPE the provider returns (instructions vs redirect), never on its name,
 * which is what keeps that promise honest.
 */

export interface PaymentMethodInfo {
  key: string
  label: string
  description: string
  /** Manual methods await a human decision; automatic ones await a callback. */
  kind: 'manual' | 'gateway'
}

export type InitiateResult =
  | {
      kind: 'instructions'
      /** Rendered on the payment page; admin-configured. */
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

/* ── Card to card ───────────────────────────────────────────────────────── */

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

/* ── Torob Pay ──────────────────────────────────────────────────────────── */

/**
 * Prepared, disabled by default. §32.
 *
 * `initiate` intentionally throws rather than returning a plausible-looking
 * redirect: the request shape has not been verified against Torob Pay's
 * documentation, and a silent stub that half-works is worse than one that
 * refuses. Enabling this is a deliberate implementation task, and the admin
 * panel reports it as unconfigured until then.
 */
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

/* ── Registry ───────────────────────────────────────────────────────────── */

const PROVIDERS: PaymentProvider[] = [new CardToCardProvider(), new TorobPayProvider()]

export function getProvider(key: string): PaymentProvider | undefined {
  return PROVIDERS.find((p) => p.key === key)
}

export function allProviders(): PaymentProvider[] {
  return PROVIDERS
}

/**
 * Methods a customer may actually choose.
 *
 * Requires BOTH enabled and configured — an enabled method with no card number
 * would render a payment page with a blank field, which is worse than not
 * offering it. Checkout validates against this list, so a posted method that is
 * switched off is rejected server-side.
 */
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

/** Configuration status for the admin panel, including disabled providers. */
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
