import type { NextConfig } from 'next'

/**
 * Security headers are emitted by the application, not the web layer.
 * Planning package §84/§E: custom Nginx configuration is assumed unavailable
 * on managed hosting, so every header we rely on must originate here.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  // Emits a self-contained Node server — no platform lock-in, runs under
  // Passenger or any panel-managed Node app. See planning package §B.
  output: 'standalone',

  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    // Derivatives are generated once at upload by sharp; these formats apply
    // to any remaining on-the-fly optimisation.
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 828, 1080, 1280, 1920],
    imageSizes: [64, 96, 128, 256, 384],
  },

  experimental: {
    // Server Actions are the mutation path for our own UI; the origin check
    // is what gives us CSRF protection without a hand-rolled token.
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Uploaded media is immutable once written — filenames are content-keyed.
        source: '/api/media/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
