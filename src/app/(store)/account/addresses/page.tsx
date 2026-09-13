import { SiteStyledText } from '@/components/site-content-provider'
import { AddressBook } from '@/components/account/address-book'
import { EmptyState } from '@/components/ui'
import { listAddresses } from '@/modules/account/service'
import { requireUser } from '@/lib/session'
import { getSiteContent } from '@/lib/site-content'

export async function generateMetadata() { const content = await getSiteContent(); return { title: content.text('addresses.title') } }

export default async function AddressesPage() {
  const user = await requireUser()
  const addresses = await listAddresses(user.id)
  const content = await getSiteContent()

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-3"><SiteStyledText contentKey="account.eyebrow">{content.text('account.eyebrow')}</SiteStyledText></p>
        <h1 className="section-title"><SiteStyledText contentKey="addresses.title">{content.text('addresses.title')}</SiteStyledText></h1>
        <p className="mt-3 max-w-lg leading-relaxed text-ink-muted">
          <SiteStyledText contentKey="addresses.description">{content.text('addresses.description')}</SiteStyledText>
        </p>
      </header>

      {addresses.length === 0 ? (
        <div className="space-y-6">
          <EmptyState
            title={content.text('addresses.empty')}
            description={content.text('addresses.emptyDescription')}
          />
          <AddressBook addresses={[]} />
        </div>
      ) : (
        <AddressBook addresses={addresses} />
      )}
    </div>
  )
}
