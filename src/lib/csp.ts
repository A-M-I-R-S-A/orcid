export interface CspOptions {
  nonce: string
  isProduction: boolean
  isHttps: boolean
}

export function buildCsp({ nonce, isProduction, isHttps }: CspOptions): string {
  const directives = [
    `default-src 'self'`,

    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? '' : ` 'unsafe-eval'`}`,

    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,

    `img-src 'self' data: blob: https:`,
    `connect-src 'self'`,

    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ]

  if (isHttps) directives.push('upgrade-insecure-requests')

  return directives.join('; ')
}
