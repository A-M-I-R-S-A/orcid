import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'

import { CartLines } from '@/components/cart-lines'
import { Alert, EmptyState, Price } from '@/components/ui'
import { getCart } from '@/modules/cart/service'
import { getCurrentUser } from '@/lib/session'
import { toPersianDigits } from '@/lib/persian'
import { getSiteContent } from '@/lib/site-content'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const content = await getSiteContent()
  return {
  title: content.text('cart.title'),
  robots: { index: false, follow: false },
  }
}

export default async function CartPage() {
  const user = await getCurrentUser()
  const cart = await getCart(user?.id ?? null)
  const content = await getSiteContent()

  if (cart.lines.length === 0) {
    return (
      <div className="container-page py-16">
        <h1 className="text-3xl text-ink mb-10"><SiteStyledText contentKey="cart.title">{content.text('cart.title')}</SiteStyledText></h1>
        <EmptyState
          title={content.text('cart.empty.title')}
          description={content.text('cart.empty.description')}
          action={{ label: content.text('cart.start'), href: '/' }}
        />
      </div>
    )
  }

  return (
    <div className="container-page py-10 md:py-16">
      <h1 className="text-3xl md:text-4xl text-ink mb-10"><SiteStyledText contentKey="cart.title">{content.text('cart.title')}</SiteStyledText></h1>

      <div className="grid lg:grid-cols-3 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-2">
          {cart.hasIssues && (
            <div className="mb-6">
              <Alert tone="pending" title={content.text('cart.issues.title')}>
                <SiteStyledText contentKey="cart.issues.body">{content.text('cart.issues.body')}</SiteStyledText>
              </Alert>
            </div>
          )}

          <CartLines lines={cart.lines} />
        </div>

        <aside className="card p-6 lg:sticky lg:top-28">
          <h2 className="text-lg text-ink mb-5"><SiteStyledText contentKey="cart.summary">{content.text('cart.summary')}</SiteStyledText></h2>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted nums">
                <SiteStyledText contentKey="cart.items">{content.text('cart.items')}</SiteStyledText> ({toPersianDigits(cart.itemCount)})
              </dt>
              <dd className="nums">
                <Price amount={cart.subtotal} size="sm" />
              </dd>
            </div>

            {cart.discountTotal > 0 && (
              <div className="flex justify-between gap-4 text-success">
                <dt><SiteStyledText contentKey="cart.discount">{content.text('cart.discount')}</SiteStyledText></dt>
                <dd className="nums">
                  − <Price amount={cart.discountTotal} size="sm" />
                </dd>
              </div>
            )}

            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted"><SiteStyledText contentKey="cart.shipping">{content.text('cart.shipping')}</SiteStyledText></dt>
              <dd className="nums">
                {cart.shippingTotal > 0 ? <Price amount={cart.shippingTotal} size="sm" /> : content.text('cart.free')}
              </dd>
            </div>

            <div className="flex justify-between gap-4 pt-4 mt-4 border-t border-line text-base">
              <dt className="font-semibold"><SiteStyledText contentKey="cart.total">{content.text('cart.total')}</SiteStyledText></dt>
              <dd>
                <Price amount={cart.grandTotal} />
              </dd>
            </div>
          </dl>

          <Link
            href={user ? '/checkout' : '/login?next=/checkout'}
            aria-disabled={cart.hasIssues}
            className={`btn btn-primary btn-block mt-7 ${
              cart.hasIssues ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            {user ? content.text('cart.continue') : content.text('cart.loginContinue')}
          </Link>

          <Link href="/" className="btn btn-ghost btn-block mt-2 text-sm">
            <SiteStyledText contentKey="cart.back">{content.text('cart.back')}</SiteStyledText>
          </Link>
        </aside>
      </div>
    </div>
  )
}
