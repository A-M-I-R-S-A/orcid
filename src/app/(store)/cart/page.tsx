import Link from 'next/link'

import { CartLines } from '@/components/cart-lines'
import { Alert, EmptyState, Price } from '@/components/ui'
import { getCart } from '@/modules/cart/service'
import { getCurrentUser } from '@/lib/session'
import { toPersianDigits } from '@/lib/persian'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'سبد خرید',
  robots: { index: false, follow: false },
}

export default async function CartPage() {
  const user = await getCurrentUser()
  const cart = await getCart(user?.id ?? null)

  if (cart.lines.length === 0) {
    return (
      <div className="container-page py-16">
        <h1 className="text-3xl text-ink mb-10">سبد خرید</h1>
        <EmptyState
          title="سبد خرید شما خالی است"
          description="محصولات مورد علاقه خود را به سبد اضافه کنید."
          action={{ label: 'شروع خرید', href: '/' }}
        />
      </div>
    )
  }

  return (
    <div className="container-page py-10 md:py-16">
      <h1 className="text-3xl md:text-4xl text-ink mb-10">سبد خرید</h1>

      <div className="grid lg:grid-cols-3 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-2">
          {cart.hasIssues && (
            <div className="mb-6">
              <Alert tone="pending" title="برخی اقلام نیاز به بررسی دارند">
                موجودی یا وضعیت بعضی محصولات تغییر کرده است. پیش از ادامه، آن‌ها را اصلاح یا حذف کنید.
              </Alert>
            </div>
          )}

          <CartLines lines={cart.lines} />
        </div>

        <aside className="card p-6 lg:sticky lg:top-28">
          <h2 className="text-lg text-ink mb-5">خلاصه سفارش</h2>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted nums">
                جمع کالاها ({toPersianDigits(cart.itemCount)})
              </dt>
              <dd className="nums">
                <Price amount={cart.subtotal} size="sm" />
              </dd>
            </div>

            {cart.discountTotal > 0 && (
              <div className="flex justify-between gap-4 text-success">
                <dt>تخفیف</dt>
                <dd className="nums">
                  − <Price amount={cart.discountTotal} size="sm" />
                </dd>
              </div>
            )}

            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">هزینه ارسال</dt>
              <dd className="text-ink-muted text-xs">در مرحله بعد محاسبه می‌شود</dd>
            </div>

            <div className="flex justify-between gap-4 pt-4 mt-4 border-t border-line text-base">
              <dt className="font-semibold">مبلغ قابل پرداخت</dt>
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
            {user ? 'ادامه و تسویه حساب' : 'ورود و تسویه حساب'}
          </Link>

          <Link href="/" className="btn btn-ghost btn-block mt-2 text-sm">
            ادامه خرید
          </Link>
        </aside>
      </div>
    </div>
  )
}
