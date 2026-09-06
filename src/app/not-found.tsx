import Link from 'next/link'

export const metadata = {
  title: 'صفحه یافت نشد',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="min-h-[60dvh] flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <p className="eyebrow mb-4 nums">۴۰۴</p>
        <h1 className="text-3xl md:text-4xl text-ink leading-[1.4]">صفحه مورد نظر یافت نشد</h1>
        <p className="mt-5 text-ink-muted leading-relaxed">
          ممکن است نشانی را اشتباه وارد کرده باشید یا این صفحه دیگر در دسترس نباشد.
        </p>

        <div className="mt-9 flex flex-wrap gap-3 justify-center">
          <Link href="/" className="btn btn-primary">
            بازگشت به صفحه اصلی
          </Link>
          <Link href="/search" className="btn btn-secondary">
            جستجوی محصولات
          </Link>
        </div>
      </div>
    </div>
  )
}
