import { SiteStyledText } from '@/components/site-content-provider'
import { redirect } from 'next/navigation'

import { CheckoutForm } from '@/components/checkout-form'
import { EmptyState, Price } from '@/components/ui'
import { ResponsiveImage } from '@/components/media'
import { getCart } from '@/modules/cart/service'
import { lastUsedAddress } from '@/modules/checkout/service'
import { listAddresses } from '@/modules/account/service'
import { getEnabledMethods } from '@/modules/payments/registry'
import { getCurrentUser } from '@/lib/session'
import { toPersianDigits } from '@/lib/persian'
import { getEnabledShippingMethods } from '@/lib/shipping-config'
import { getSiteContent } from '@/lib/site-content'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const content = await getSiteContent()
  return {
  title: content.text('checkout.title'),
  robots: { index: false, follow: false },
  }
}

export default async function CheckoutPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/checkout')

  const cart = await getCart(user.id)
  const content = await getSiteContent()

  if (cart.lines.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title={content.text('checkout.empty.title')}
          description={content.text('checkout.emptyDescription')}
          action={{ label: content.text('cart.start'), href: '/' }}
        />
      </div>
    )
  }

  if (cart.hasIssues) redirect('/cart')

  const [methods, prefill, saved, shippingMethods] = await Promise.all([
    getEnabledMethods({ amount: cart.grandTotal }),
    lastUsedAddress(user.id),
    listAddresses(user.id),
    getEnabledShippingMethods(),
  ])

  if (methods.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title={content.text('checkout.unavailable.title')}
          description={content.text('checkout.noPayments')}
          action={{ label: content.text('checkout.backCart'), href: '/cart' }}
        />
      </div>
    )
  }

  if (shippingMethods.length === 0) {
    return <div className="container-page py-16"><EmptyState title={content.text('checkout.noShipping')} description={content.text('checkout.contactSupport')} action={{ label: content.text('checkout.backCart'), href: '/cart' }} /></div>
  }

  return (
    <div className="container-page py-10 md:py-16">
      <h1 className="text-3xl md:text-4xl text-ink mb-10"><SiteStyledText contentKey="checkout.title">{content.text('checkout.title')}</SiteStyledText></h1>

      <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-3">
          <CheckoutForm
            methods={methods}
            shippingMethods={shippingMethods}
            savedAddresses={saved.map((a) => ({
              id: a.id,
              fullName: a.fullName,
              phone: a.phone,
              province: a.province,
              city: a.city,
              addressLine: a.addressLine,
              postalCode: a.postalCode,
              isDefault: a.isDefault,
            }))}
            defaultValues={{
              fullName: prefill?.fullName ?? user.fullName ?? '',
              phone: prefill?.phone ?? user.phone,
              province: (prefill && 'province' in prefill ? prefill.province : '') ?? '',
              city: (prefill && 'city' in prefill ? prefill.city : '') ?? '',
              addressLine: (prefill && 'addressLine' in prefill ? prefill.addressLine : '') ?? '',
              postalCode: (prefill && 'postalCode' in prefill ? prefill.postalCode : '') ?? '',
            }}
          />
        </div>

        <aside className="lg:col-span-2 card p-6 lg:sticky lg:top-28">
          <h2 className="text-lg text-ink mb-5"><SiteStyledText contentKey="checkout.yourOrder">{content.text('checkout.yourOrder')}</SiteStyledText></h2>

          <ul className="space-y-4 mb-6 max-h-[340px] overflow-y-auto">
            {cart.lines.map((line) => (
              <li key={line.itemId} className="flex gap-3">
                <div className="shrink-0 w-14 rounded-lg overflow-hidden bg-surface-sunken">
                  <ResponsiveImage
                    path={line.imagePath}
                    alt={line.imageAlt ?? line.productName}
                    width={200}
                    height={250}
                    sizes="56px"
                    className="w-full h-auto object-cover aspect-[4/5]"
                  />
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <p className="text-ink line-clamp-1">{line.productName}</p>
                  {line.variantLabel && (
                    <p className="text-xs text-ink-muted mt-0.5">{line.variantLabel}</p>
                  )}
                  <p className="text-xs text-ink-subtle mt-0.5 nums">
                    <SiteStyledText contentKey="checkout.quantity">{content.text('checkout.quantity')}</SiteStyledText>: {toPersianDigits(line.quantity)}
                  </p>
                </div>
                <Price amount={line.lineTotal} size="sm" className="shrink-0" />
              </li>
            ))}
          </ul>

          <dl className="space-y-3 text-sm pt-5 border-t border-line">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted"><SiteStyledText contentKey="cart.items">{content.text('cart.items')}</SiteStyledText></dt>
              <dd>
                <Price amount={cart.subtotal} size="sm" />
              </dd>
            </div>
            {cart.discountTotal > 0 && (
              <div className="flex justify-between gap-4 text-success">
                <dt><SiteStyledText contentKey="cart.discount">{content.text('cart.discount')}</SiteStyledText></dt>
                <dd>
                  − <Price amount={cart.discountTotal} size="sm" />
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted"><SiteStyledText contentKey="cart.shipping">{content.text('cart.shipping')}</SiteStyledText></dt>
              <dd>{cart.shippingTotal > 0 ? <Price amount={cart.shippingTotal} size="sm" /> : content.text('cart.free')}</dd>
            </div>
            <div className="flex justify-between gap-4 pt-4 mt-4 border-t border-line">
              <dt className="font-semibold"><SiteStyledText contentKey="cart.total">{content.text('cart.total')}</SiteStyledText></dt>
              <dd>
                <Price amount={cart.grandTotal} />
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  )
}
