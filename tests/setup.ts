import { randomBytes } from 'node:crypto'

process.env.OTP_PEPPER ??= randomBytes(32).toString('hex')
process.env.SESSION_SECRET ??= randomBytes(32).toString('hex')
process.env.AUTH_SECRET ??= randomBytes(32).toString('hex')
process.env.ENCRYPTION_KEY ??= randomBytes(32).toString('hex')
process.env.APP_URL ??= 'https://orchidbra.ir'
process.env.TZ = 'Asia/Tehran'
