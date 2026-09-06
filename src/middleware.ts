import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { buildCsp } from '@/lib/csp'

function makeNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

export function middleware(request: NextRequest) {
  if (
    request.headers.get('next-router-prefetch') !== null ||
    request.headers.get('rsc') !== null
  ) {
    return NextResponse.next()
  }

  const nonce = makeNonce()

  const forwarded = request.headers.get('x-forwarded-proto')
  const protocol = forwarded ?? new URL(request.url).protocol.replace(':', '')

  const csp = buildCsp({
    nonce,
    isProduction: process.env.NODE_ENV === 'production',
    isHttps: protocol === 'https',
  })

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)

  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api/media|_next/static|_next/image|favicon.ico|logo.png|icon.png).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
