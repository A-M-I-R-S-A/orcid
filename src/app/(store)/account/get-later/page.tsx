import { SiteStyledText } from '@/components/site-content-provider'
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
import { getSiteContent } from '@/lib/site-content'

export async function generateMetadata() { const content = await getSiteContent(); return { title: content.text('later.title') } }

export default async function GetLaterPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>
}) {
  const user = await requireUser()
  const { submitted } = await searchParams
  const [config, carts, addresses, methods, shipping, content] = await Promise.all([
    getConfig(),
    listForUser(user.id),
    listAddresses(user.id),
    getEnabledMethods(),
    getShippingConfig(),
    getSiteContent(),
  ])
  const statusLabels = { draft: content.text('later.draft'), open: content.text('later.open'), submitted: content.text('later.submitted'), converted: content.text('later.converted'), cancelled: content.text('later.cancelled') }
  const activeSummary = carts.find((cart) => cart.status === 'open')
  const active = activeSummary ? await getForUser(user.id, activeSummary.id) : null
  const expired = Boolean(active?.expiresAt && active.expiresAt.getTime() < Date.now())

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-3"><SiteStyledText contentKey="account.eyebrow">{content.text('account.eyebrow')}</SiteStyledText></p>
        <h1 className="section-title">{config.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{config.description}</p>
      </header>

      {submitted === '1' && (
        <Alert tone="positive" title={content.text('later.decisionSaved')}>
          <SiteStyledText contentKey="later.allReturned">{content.text('later.allReturned')}</SiteStyledText>
        </Alert>
      )}

      {active ? (
        <>
          {expired ? (
            <Alert tone="negative" title={content.text('later.expired')}>
              <SiteStyledText contentKey="later.expiredBody">{content.text('later.expiredBody')}</SiteStyledText>
            </Alert>
          ) : active.expiresAt ? (
            <div className="rounded-xl border border-warning/35 bg-warning-bg/60 px-4 py-3 text-sm text-warning">
              <SiteStyledText contentKey="later.deadline">{content.text('later.deadline')}</SiteStyledText>: <span className="nums font-medium">{formatJalaliDateTime(active.expiresAt)}</span>
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
          title={config.enabled ? content.text('later.empty') : content.text('later.disabled')}
          description={config.enabled ? content.text('later.emptyBody') : undefined}
          action={{ label: config.enabled ? content.text('common.viewProducts') : content.text('later.backDashboard'), href: config.enabled ? '/products' : '/account' }}
        />
      ) : null}

      {carts.length > 0 && (
        <section aria-labelledby="get-later-history">
          <h2 id="get-later-history" className="mb-4 text-lg text-ink"><SiteStyledText contentKey="later.history">{content.text('later.history')}</SiteStyledText></h2>
          <ul className="space-y-3">
            {carts.map((cart) => (
              <li key={cart.id} className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                <div>
                  <p className="font-medium text-ink"><SiteStyledText contentKey="later.cartPrefix">{content.text('later.cartPrefix')}</SiteStyledText> {toPersianDigits(cart.id)}</p>
                  <p className="nums mt-1 text-xs text-ink-subtle">{formatJalali(cart.createdAt)} • {toPersianDigits(Number(cart.itemCount))} <SiteStyledText contentKey="account.item">{content.text('account.item')}</SiteStyledText></p>
                </div>
                <div className="flex items-center gap-4">
                  <Price amount={Number(cart.total)} size="sm" />
                  {cart.orderId ? (
                    <Link href={`/account/orders/${cart.orderId}`} className="btn btn-secondary btn-sm"><SiteStyledText contentKey="later.viewOrder">{content.text('later.viewOrder')}</SiteStyledText></Link>
                  ) : (
                    <span className="badge badge-neutral">{statusLabels[cart.status]}</span>
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
