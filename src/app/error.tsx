'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Error boundary. §82.
 *
 * The customer sees Persian and nothing technical. `error.digest` is the only
 * identifier shown — Next generates it and logs the real stack server-side, so
 * support can correlate a report to a log line without the stack ever reaching
 * the browser.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Server-side logging already happened; this catches client-side faults.
    console.error('Client error boundary:', error.message, error.digest)
  }, [error])

  return (
    <div className="min-h-[60dvh] flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <h1 className="text-3xl md:text-4xl text-ink leading-[1.4]">خطایی رخ داد</h1>
        <p className="mt-5 text-ink-muted leading-relaxed">
          متأسفانه در نمایش این صفحه مشکلی پیش آمد. لطفاً دوباره تلاش کنید.
        </p>

        <div className="mt-9 flex flex-wrap gap-3 justify-center">
          <button type="button" onClick={reset} className="btn btn-primary">
            تلاش دوباره
          </button>
          <Link href="/" className="btn btn-secondary">
            صفحه اصلی
          </Link>
        </div>

        {error.digest && (
          <p className="mt-8 text-xs text-ink-subtle nums" dir="ltr">
            کد پیگیری: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
