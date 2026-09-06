#!/usr/bin/env node

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import mysql from 'mysql2/promise'

const host = (() => {
  try {
    return new URL(process.env.APP_URL ?? 'http://localhost').hostname
  } catch {
    return ''
  }
})()

if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`Refusing to run: APP_URL points at ${host || 'an unknown host'}, not localhost.`)
  console.error('Reset a real password from the admin panel, not from a script.')
  process.exit(1)
}

const [kind, identifier, password, ...rest] = process.argv.slice(2)

if (!kind || !identifier || !password) {
  console.error('Usage: node --env-file=.env scripts/dev-account.mjs admin|customer <id> <password> [name]')
  process.exit(1)
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters — the application enforces the same rule.')
  process.exit(1)
}

const scrypt = promisify(scryptCb)
const [N, r, p, KEY_LEN] = [16384, 8, 1, 64]

const salt = randomBytes(16)
const derived = await scrypt(password, salt, KEY_LEN, { N, r, p })
const passwordHash = `scrypt:${N}:${r}:${p}:${salt.toString('hex')}:${derived.toString('hex')}`

const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
})

if (kind === 'admin') {
  const [result] = await db.execute(
    `UPDATE admin_users
        SET password_hash = ?, failed_attempts = 0, locked_until = NULL, is_active = 1
      WHERE username = ?`,
    [passwordHash, identifier],
  )

  if (result.affectedRows === 0) {
    console.error(`No administrator named "${identifier}". Run \`npm run db:seed\` first.`)
    await db.end()
    process.exit(1)
  }

  console.log(`✓ administrator "${identifier}" — password set. Sign in at /admin/login`)
} else if (kind === 'customer') {
  const phone = identifier
  if (!/^09\d{9}$/.test(phone)) {
    console.error('Phone must be 11 digits starting 09.')
    await db.end()
    process.exit(1)
  }

  const [[existing]] = await db.query('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone])

  if (existing) {
    await db.execute(
      `UPDATE users
          SET password_hash = ?, password_set_at = NOW(),
              phone_verified_at = COALESCE(phone_verified_at, NOW()), is_active = 1
        WHERE id = ?`,
      [passwordHash, existing.id],
    )
    console.log(`✓ customer ${phone} — password set.`)
  } else {
    await db.execute(
      `INSERT INTO users (phone, full_name, password_hash, password_set_at, phone_verified_at, is_active)
       VALUES (?, ?, ?, NOW(), NOW(), 1)`,
      [phone, rest.join(' ') || 'مشتری آزمایشی', passwordHash],
    )
    console.log(`✓ customer ${phone} — created and verified.`)
  }

  console.log('Sign in at /login')
} else {
  console.error(`Unknown account kind "${kind}" — expected admin or customer.`)
  await db.end()
  process.exit(1)
}

const table = kind === 'admin' ? 'admin_users' : 'users'
const column = kind === 'admin' ? 'username' : 'phone'
const [[row]] = await db.query(
  `SELECT password_hash FROM ${table} WHERE ${column} = ? LIMIT 1`,
  [identifier],
)
await db.end()

const [, nRaw, rRaw, pRaw, saltHex, hashHex] = row.password_hash.split(':')
const expected = Buffer.from(hashHex, 'hex')
const check = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, {
  N: Number(nRaw),
  r: Number(rRaw),
  p: Number(pRaw),
})

if (!timingSafeEqual(check, expected)) {
  console.error('✗ Verification failed — the stored hash does not match the password.')
  process.exit(1)
}

console.log(`  username/phone: ${identifier}`)
console.log(`  password:       ${password}`)
