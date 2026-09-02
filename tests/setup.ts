import { randomBytes } from 'node:crypto'

/**
 * Test environment.
 *
 * Secrets are generated per run rather than hardcoded, so a fixture value can
 * never accidentally become a real one, and so tests cannot depend on a
 * specific key.
 */
process.env.OTP_PEPPER ??= randomBytes(32).toString('hex')
process.env.SESSION_SECRET ??= randomBytes(32).toString('hex')
process.env.AUTH_SECRET ??= randomBytes(32).toString('hex')
process.env.ENCRYPTION_KEY ??= randomBytes(32).toString('hex')
process.env.APP_URL ??= 'https://orchid-clothing.ir'
process.env.TZ = 'Asia/Tehran'
