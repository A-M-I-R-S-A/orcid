import type { Metadata, Viewport } from 'next'
import { Lalezar, Vazirmatn } from 'next/font/google'

import { getNamespace } from '@/lib/settings'
import { getTheme, themeToCss } from '@/lib/theme'
import { getTypography, typographyToCss } from '@/lib/typography'
import { organizationSchema, siteUrl, websiteSchema } from '@/lib/seo'
import { JsonLd } from '@/components/json-ld'

import './globals.css'

const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  variable: '--font-vazirmatn',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  preload: true,
})

const lalezar = Lalezar({
  subsets: ['arabic'],
  variable: '--font-lalezar',
  display: 'swap',
  weight: '400',
  preload: true,
})

export async function generateMetadata(): Promise<Metadata> {
  const site = await getNamespace('site')
  const seo = await getNamespace('seo')

  const siteName = site.siteName || 'ارکید'

  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: seo.defaultTitle || `${siteName} — فروشگاه لباس زیر زنانه`,
      template: `%s${seo.titleSeparator || ' | '}${siteName}`,
    },
    description:
      seo.defaultDescription ||
      'فروشگاه اینترنتی ارکید؛ لباس زیر زنانه با کیفیت، طراحی ظریف و ارسال محرمانه به سراسر ایران.',
    applicationName: siteName,
    alternates: { canonical: '/' },
    icons: {
      icon: site.faviconPath ? `/api/media/${site.faviconPath}` : '/icon.png',
    },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName,
      url: siteUrl(),
    },
    formatDetection: {
      telephone: false,
      address: false,
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#EDE6DC',
  colorScheme: 'light',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [theme, typography, enamad] = await Promise.all([
    getTheme(),
    getTypography(),
    getNamespace('enamad'),
  ])

  const [orgSchema, siteSchema] = await Promise.all([organizationSchema(), websiteSchema()])

  const themeCss = `:root{${themeToCss(theme)};${typographyToCss(typography)}}`

  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} ${lalezar.variable}`}>
      <head>
        <style
          id="orchid-theme"
          dangerouslySetInnerHTML={{ __html: themeCss }}
        />
        <JsonLd data={[orgSchema, siteSchema]} />
        {enamad.metaTag ? (
          <meta name="enamad" content={enamad.metaTag} />
        ) : null}
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only">
          پرش به محتوای اصلی
        </a>
        {children}
      </body>
    </html>
  )
}
