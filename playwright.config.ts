import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests. §101.
 *
 * These require a running application with a seeded database:
 *
 *   npm run db:migrate
 *   npm run db:seed -- --demo
 *   npm run build && npm start
 *   npm run test:e2e
 *
 * Run against a PRODUCTION build, not `next dev`. The dev server compiles each
 * route on first request, so the first run against it is flaky in a way that
 * says nothing about the application — set E2E_BASE_URL only when pointing at
 * an already-built server.
 *
 * The responsive projects are not decoration. §9 makes mobile the primary
 * shopping surface, so every customer-facing flow is exercised at 375px as
 * well as on desktop — a checkout that only works on a laptop is a broken
 * checkout for most of the traffic.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
    { name: 'tablet', use: { ...devices['iPad Mini'] } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
