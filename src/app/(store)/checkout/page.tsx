import { redirect } from 'next/navigation'

import { CheckoutForm } from '@/components/checkout-form'
import { EmptyState, Price } from '@/components/ui'
import { ResponsiveImage } from '@/components/media'
import { getCart } from '@/modules/cart/service'
import { lastUsedAddress } from '@/modules/checkout/service'
import { getEnabledMethods } from '@/modules/payments/registry'
import { getCurrentUser } from '@/lib/session'
import { toPersianDigits } from '@/lib/persian'

/**
 * Checkout. §22 / §70.
 *
 * noindex, dynamic. Everything shown here — line prices, the total, the
 * available payment methods — is computed server-side; the form posts only
 * the address and the chosen method.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'تسویه حساب',
  robots: { index: false, follow: false },
}

export default async function CheckoutPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/checkout')

  const cart = await getCart(user.id)

  if (cart.lines.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="سبد خرید شما خالی است"
          description="پیش از تسویه حساب، محصولی به سبد خرید اضافه کنید."
          action={{ label: 'شروع خرید', href: '/' }}
        />
      </div>
    )
  }

  // A cart with stock or availability problems must be fixed before an order
  // can be written — sending it into the transaction would only fail there.
  if (cart.hasIssues) redirect('/cart')

  const [methods, prefill] = await Promise.all([getEnabledMethods(), lastUsedAddress(user.id)])

  if (methods.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="در حال حاضر امکان ثبت سفارش وجود ندارد"
          description="هیچ روش پرداختی فعال نیست. لطفاً بعداً تلاش کنید یا با پشتیبانی تماس بگیرید."
          action={{ label: 'بازگشت به سبد خرید', href: '/cart' }}
        />
      </div>
    )
  }

  return (
    <div className="container-page py-10 md:py-16">
      <h1 className="text-3xl md:text-4xl text-ink mb-10">تسویه حساب</h1>

      <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-3">
          <CheckoutForm
            methods={methods}
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
          <h2 className="text-lg text-ink mb-5">سفارش شما</h2>

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
                    تعداد: {toPersianDigits(line.quantity)}
                  </p>
                </div>
                <Price amount={line.lineTotal} size="sm" className="shrink-0" />
              </li>
            ))}
          </ul>

          <dl className="space-y-3 text-sm pt-5 border-t border-line">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">جمع کالاها</dt>
              <dd>
                <Price amount={cart.subtotal} size="sm" />
              </dd>
            </div>
            {cart.discountTotal > 0 && (
              <div className="flex justify-between gap-4 text-success">
                <dt>تخفیف</dt>
                <dd>
                  − <Price amount={cart.discountTotal} size="sm" />
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4 pt-4 mt-4 border-t border-line">
              <dt className="font-semibold">مبلغ قابل پرداخت</dt>
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
