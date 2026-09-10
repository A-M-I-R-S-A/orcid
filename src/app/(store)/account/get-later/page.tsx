import Link from 'next/link'

import { GetLaterForm } from '@/components/account/get-later-form'
import { Alert, EmptyState, Price } from '@/components/ui'
import { formatJalali, formatJalaliDateTime } from '@/lib/jalali'
import { requireUser } from '@/lib/session'
import { listAddresses } from '@/modules/account/service'
import { getConfig, getForUser, listForUser } from '@/modules/get-later/service'
import { getEnabledMethods } from '@/modules/payments/registry'
import { toPersianDigits } from '@/lib/persian'
import { getShippingConfig } from '@/lib/shipping-config'

export const metadata = { title: 'سبد پرداخت بعدی' }

const STATUS_LABELS = {
  draft: 'در حال آماده‌سازی',
  open: 'منتظر تصمیم شما',
  submitted: 'ثبت‌شده برای بازگشت',
  converted: 'آماده پرداخت',
  cancelled: 'لغوشده',
} as const

export default async function GetLaterPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>
}) {
  const user = await requireUser()
  const { submitted } = await searchParams
  const [config, carts, addresses, methods, shipping] = await Promise.all([
    getConfig(),
    listForUser(user.id),
    listAddresses(user.id),
    getEnabledMethods(),
    getShippingConfig(),
  ])
  const activeSummary = carts.find((cart) => cart.status === 'open')
  const active = activeSummary ? await getForUser(user.id, activeSummary.id) : null
  const expired = Boolean(active?.expiresAt && active.expiresAt.getTime() < Date.now())

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-3">حساب کاربری</p>
        <h1 className="section-title">{config.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{config.description}</p>
      </header>

      {submitted === '1' && (
        <Alert tone="positive" title="تصمیم شما ثبت شد">
          همه کالاها برای بازگشت مشخص شدند و مبلغی برای پرداخت باقی نماند.
        </Alert>
      )}

      {active ? (
        <>
          {expired ? (
            <Alert tone="negative" title="مهلت تصمیم‌گیری پایان یافته است">
              برای تمدید مهلت یا ثبت تصمیم با پشتیبانی تماس بگیرید.
            </Alert>
          ) : active.expiresAt ? (
            <div className="rounded-xl border border-warning/35 bg-warning-bg/60 px-4 py-3 text-sm text-warning">
              مهلت ثبت تصمیم: <span className="nums font-medium">{formatJalaliDateTime(active.expiresAt)}</span>
            </div>
          ) : null}
          <GetLaterForm
            cartId={active.id}
            items={active.items}
            addresses={addresses}
            methods={methods}
            submitLabel={config.submitLabel}
            expired={expired}
            shipping={shipping}
          />
        </>
      ) : carts.length === 0 ? (
        <EmptyState
          title={config.enabled ? 'سبد پرداخت بعدی شما خالی است' : 'این خدمت در حال حاضر فعال نیست'}
          description={config.enabled ? 'از صفحه هر محصول، گزینه «افزودن به سبد پرداخت بعدی» را انتخاب کنید.' : undefined}
          action={{ label: config.enabled ? 'مشاهده محصولات' : 'بازگشت به پیشخوان', href: config.enabled ? '/products' : '/account' }}
        />
      ) : null}

      {carts.length > 0 && (
        <section aria-labelledby="get-later-history">
          <h2 id="get-later-history" className="mb-4 text-lg text-ink">سابقه سبدها</h2>
          <ul className="space-y-3">
            {carts.map((cart) => (
              <li key={cart.id} className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                <div>
                  <p className="font-medium text-ink">سبد شماره {toPersianDigits(cart.id)}</p>
                  <p className="nums mt-1 text-xs text-ink-subtle">{formatJalali(cart.createdAt)} • {toPersianDigits(Number(cart.itemCount))} کالا</p>
                </div>
                <div className="flex items-center gap-4">
                  <Price amount={Number(cart.total)} size="sm" />
                  {cart.orderId ? (
                    <Link href={`/account/orders/${cart.orderId}`} className="btn btn-secondary btn-sm">مشاهده سفارش</Link>
                  ) : (
                    <span className="badge badge-neutral">{STATUS_LABELS[cart.status]}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
