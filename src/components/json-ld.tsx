import { getNonce } from '@/lib/nonce'
import { jsonLd } from '@/lib/seo'
import type { Json } from '@/lib/seo'

export async function JsonLd({ data }: { data: Json | Json[] }) {
  const nonce = await getNonce()

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
    />
  )
}
