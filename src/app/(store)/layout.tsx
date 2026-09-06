import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { HeaderCondenser } from '@/components/header-condenser'
import { WishlistProvider } from '@/components/wishlist-provider'
import { getCurrentUser } from '@/lib/session'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <WishlistProvider signedIn={Boolean(user)}>
      <div className="flex min-h-[100dvh] flex-col">
        <HeaderCondenser />
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </WishlistProvider>
  )
}
