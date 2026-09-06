import { AddressBook } from '@/components/account/address-book'
import { EmptyState } from '@/components/ui'
import { listAddresses } from '@/modules/account/service'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'نشانی‌ها' }

export default async function AddressesPage() {
  const user = await requireUser()
  const addresses = await listAddresses(user.id)

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-3">حساب کاربری</p>
        <h1 className="section-title">نشانی‌ها</h1>
        <p className="mt-3 max-w-lg leading-relaxed text-ink-muted">
          نشانی‌های ذخیره‌شده هنگام تسویه حساب در دسترس شماست. نشانی پیش‌فرض به‌صورت خودکار
          انتخاب می‌شود.
        </p>
      </header>

      {addresses.length === 0 ? (
        <div className="space-y-6">
          <EmptyState
            title="هنوز نشانی ثبت نکرده‌اید"
            description="با ثبت نشانی، تسویه حساب در سفارش‌های بعدی سریع‌تر انجام می‌شود."
          />
          <AddressBook addresses={[]} />
        </div>
      ) : (
        <AddressBook addresses={addresses} />
      )}
    </div>
  )
}
