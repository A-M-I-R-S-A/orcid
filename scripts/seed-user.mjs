#!/usr/bin/env node

import mysql from 'mysql2/promise'

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run with NODE_ENV=production.')
  process.exit(1)
}

const phone = process.argv[2]
const password = process.argv[3]
const fullName = process.argv[4] ?? 'Amir Hossein'
const email = process.argv[5] ?? null

if (!phone || !password) {
  console.error(
    'Usage: node --env-file=.env scripts/seed-user.mjs <phone> <password> [fullName] [email]',
  )
  process.exit(1)
}

if (!/^09\d{9}$/.test(phone)) {
  console.error('Invalid Iranian phone number. Example: 09123456789')
  process.exit(1)
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters.')
  process.exit(1)
}

// Load the project's existing password hashing implementation.
const { hashPassword } = await import('../src/lib/crypto.ts')

const passwordHash = await hashPassword(password)

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
})

try {
  const [existing] = await connection.query(
    `SELECT id
       FROM users
      WHERE phone = ?
      LIMIT 1`,
    [phone],
  )

  if (existing.length > 0) {
    const user = existing[0]

    await connection.query(
      `UPDATE users
          SET full_name = ?,
              email = ?,
              password_hash = ?,
              password_set_at = UTC_TIMESTAMP(),
              phone_verified_at = COALESCE(phone_verified_at, UTC_TIMESTAMP()),
              is_active = 1,
              disabled_reason = NULL,
              updated_at = UTC_TIMESTAMP()
        WHERE id = ?`,
      [fullName, email, passwordHash, user.id],
    )

    console.log('User updated successfully.')
    console.log(`id:       ${user.id}`)
    console.log(`phone:    ${phone}`)
    console.log(`password: ${password}`)
    console.log(`name:     ${fullName}`)
    console.log('phone verified: yes')
  } else {
    const [result] = await connection.query(
      `INSERT INTO users
        (
          phone,
          full_name,
          email,
          password_hash,
          password_set_at,
          phone_verified_at,
          is_active
        )
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), 1)`,
      [phone, fullName, email, passwordHash],
    )

    console.log('User created successfully.')
    console.log(`id:       ${result.insertId}`)
    console.log(`phone:    ${phone}`)
    console.log(`password: ${password}`)
    console.log(`name:     ${fullName}`)
    console.log('phone verified: yes')
  }
} finally {
  await connection.end()
}
