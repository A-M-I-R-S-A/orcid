import { SiteStyledText } from '@/components/site-content-provider'
import Link from 'next/link'
import { getSiteContent } from '@/lib/site-content'

export async function generateMetadata() {
  const content = await getSiteContent()
  return {
  title: content.text('meta.notFound'),
  robots: { index: false, follow: true },
  }
}

export default async function NotFound() {
  const content = await getSiteContent()
  return (
    <div className="min-h-[60dvh] flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <p className="eyebrow mb-4 nums">۴۰۴</p>
        <h1 className="text-3xl md:text-4xl text-ink leading-[1.4]"><SiteStyledText contentKey="notFound.title">{content.text('notFound.title')}</SiteStyledText></h1>
        <p className="mt-5 text-ink-muted leading-relaxed">
          <SiteStyledText contentKey="notFound.description">{content.text('notFound.description')}</SiteStyledText>
        </p>

        <div className="mt-9 flex flex-wrap gap-3 justify-center">
          <Link href="/" className="btn btn-primary">
            <SiteStyledText contentKey="notFound.home">{content.text('notFound.home')}</SiteStyledText>
          </Link>
          <Link href="/search" className="btn btn-secondary">
            <SiteStyledText contentKey="notFound.search">{content.text('notFound.search')}</SiteStyledText>
          </Link>
        </div>
      </div>
    </div>
  )
}
