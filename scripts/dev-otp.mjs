#!/usr/bin/env node

import { createHmac, timingSafeEqual } from 'node:crypto'
import mysql from 'mysql2/promise'

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run with NODE_ENV=production.')
  process.exit(1)
}

const phone = process.argv[2]
if (!phone) {
  console.error('Usage: node --env-file=.env scripts/dev-otp.mjs <phone>')
  process.exit(1)
}

const pepper = process.env.OTP_PEPPER
if (!pepper) {
  console.error('OTP_PEPPER is not set — run with --env-file=.env')
  process.exit(1)
}

const hash = (code) => createHmac('sha256', pepper).update(`${phone}:${code}`).digest('hex')

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
})

const [rows] = await connection.query(
  `SELECT code_hash, purpose, expires_at, consumed_at
     FROM otp_requests
    WHERE phone = ?
    ORDER BY created_at DESC
    LIMIT 1`,
  [phone],
)

await connection.end()

const row = rows[0]
if (!row) {
  console.error(`No OTP on record for ${phone}.`)
  process.exit(1)
}

if (row.consumed_at) console.warn('! This code has already been consumed.')
if (new Date(row.expires_at) < new Date()) console.warn('! This code has expired.')

const expected = Buffer.from(row.code_hash, 'hex')

for (let i = 0; i < 1_000_000; i++) {
  const code = String(i).padStart(6, '0')
  const candidate = Buffer.from(hash(code), 'hex')
  if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
    console.log(`purpose: ${row.purpose}`)
    console.log(`code:    ${code}`)
    process.exit(0)
  }
}

console.error('No match — the pepper in .env probably differs from the one that issued it.')
process.exit(1)
