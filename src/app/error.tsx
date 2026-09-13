'use client'

import { SiteStyledText } from '@/components/site-content-provider'
import { useEffect } from 'react'
import Link from 'next/link'
import { useSiteText } from '@/components/site-content-provider'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const title = useSiteText('error.title', 'خطایی رخ داد')
  const description = useSiteText('error.description', 'متأسفانه در نمایش این صفحه مشکلی پیش آمد. لطفاً دوباره تلاش کنید.')
  const retry = useSiteText('error.retry', 'تلاش دوباره')
  const home = useSiteText('error.home', 'صفحه اصلی')
  const trackingCode = useSiteText('error.trackingCode', 'کد پیگیری')
  useEffect(() => {
    console.error('Client error boundary:', error.message, error.digest)
  }, [error])

  return (
    <div className="min-h-[60dvh] flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <h1 className="text-3xl md:text-4xl text-ink leading-[1.4]"><SiteStyledText contentKey="error.title">{title}</SiteStyledText></h1>
        <p className="mt-5 text-ink-muted leading-relaxed">
          <SiteStyledText contentKey="error.description">{description}</SiteStyledText>
        </p>

        <div className="mt-9 flex flex-wrap gap-3 justify-center">
          <button type="button" onClick={reset} className="btn btn-primary">
            <SiteStyledText contentKey="error.retry">{retry}</SiteStyledText>
          </button>
          <Link href="/" className="btn btn-secondary">
            <SiteStyledText contentKey="error.home">{home}</SiteStyledText>
          </Link>
        </div>

        {error.digest && (
          <p className="mt-8 text-xs text-ink-subtle nums" dir="ltr">
            <SiteStyledText contentKey="error.trackingCode">{trackingCode}</SiteStyledText>: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
