import mysql from 'mysql2/promise'
import { hashPassword } from '../src/lib/crypto'

async function main() {
  const phone = process.argv[2]
  const password = process.argv[3]
  const fullName = process.argv[4] ?? 'Amir Hossein'

  if (!phone || !password) {
    console.error(
      'Usage: npx tsx scripts/seed-user.ts <phone> <password> [fullName]',
    )
    process.exit(1)
  }

  if (!/^09\d{9}$/.test(phone)) {
    console.error('Invalid Iranian phone number.')
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)

  const db = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: 'Z',
  })

  try {
    const [existing] = await db.query(
      'SELECT id FROM users WHERE phone = ? LIMIT 1',
      [phone],
    )

    if ((existing as any[]).length > 0) {
      const user = (existing as any[])[0]

      await db.query(
        `UPDATE users
         SET full_name = ?,
             password_hash = ?,
             password_set_at = UTC_TIMESTAMP(),
             phone_verified_at = COALESCE(phone_verified_at, UTC_TIMESTAMP()),
             is_active = 1,
             disabled_reason = NULL,
             updated_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [fullName, passwordHash, user.id],
      )

      console.log('Test user updated successfully.')
      console.log(`ID: ${user.id}`)
    } else {
      const [result] = await db.query(
        `INSERT INTO users
         (
           phone,
           full_name,
           password_hash,
           password_set_at,
           phone_verified_at,
           is_active
         )
         VALUES (?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), 1)`,
        [phone, fullName, passwordHash],
      )

      console.log('Test user created successfully.')
      console.log(`ID: ${(result as any).insertId}`)
    }

    console.log(`Phone: ${phone}`)
    console.log(`Password: ${password}`)
    console.log(`Name: ${fullName}`)
    console.log('Phone verified: YES')
  } finally {
    await db.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})