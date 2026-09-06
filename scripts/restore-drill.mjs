#!/usr/bin/env node

import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

import mysql from 'mysql2/promise'

const DRILL_DB = process.env.DRILL_DB_NAME ?? process.env.TEST_DB_NAME ?? 'orchid_test'

if (!/drill|test/i.test(DRILL_DB)) {
  console.error(`Refusing to restore into "${DRILL_DB}" — the name must contain "drill" or "test".`)
  process.exit(1)
}

const backupDir =
  process.env.BACKUP_DIR ?? path.join(path.resolve(process.env.UPLOAD_DIR ?? './storage'), 'backups')

const dumps = (await readdir(backupDir).catch(() => []))
  .filter((n) => n.startsWith('orchid-') && n.endsWith('.sql.gz'))
  .sort()

const newest = dumps[dumps.length - 1]
if (!newest) {
  console.error(`No dump found in ${backupDir}. Take one first:`)
  console.error('  curl -H "Authorization: Bearer $CRON_SECRET" ".../api/cron?backup=force"')
  process.exit(1)
}

const dumpPath = path.join(backupDir, newest)
const { size } = await stat(dumpPath)
console.log(`\nRestore drill\n  dump   ${newest} (${(size / 1024).toFixed(1)} KB)\n  target ${DRILL_DB}\n`)

const chunks = []
await pipeline(createReadStream(dumpPath), createGunzip(), async function* (source) {
  for await (const chunk of source) chunks.push(chunk)
  yield
})
const sql = Buffer.concat(chunks).toString('utf8')

const admin = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
})

let failed = false

try {
  await admin.query(`USE \`${DRILL_DB}\``)
  await admin.query("SET time_zone = '+00:00'")
  await admin.query('SET FOREIGN_KEY_CHECKS = 0')

  const [existing] = await admin.query(
    `SELECT table_name AS t FROM information_schema.tables
      WHERE table_schema = '${DRILL_DB}' AND table_type = 'BASE TABLE'`,
  )
  for (const { t } of existing) {
    await admin.query(`DROP TABLE IF EXISTS \`${t}\``)
  }
  await admin.query('SET FOREIGN_KEY_CHECKS = 1')

  const started = Date.now()
  await admin.query(sql)
  console.log(`  ✓ restored in ${Date.now() - started} ms`)

  const [[counts]] = await admin.query(
    `SELECT (SELECT COUNT(*) FROM products) AS products,
            (SELECT COUNT(*) FROM product_variants) AS variants,
            (SELECT COUNT(*) FROM orders) AS orders,
            (SELECT COUNT(*) FROM order_items) AS order_items,
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM settings) AS settings`,
  )

  console.table(counts)

  const [[{ tables }]] = await admin.query(
    `SELECT COUNT(*) AS tables FROM information_schema.tables
      WHERE table_schema = '${DRILL_DB}' AND table_type = 'BASE TABLE'`,
  )
  console.log(`  tables restored: ${tables}`)

  const [rows] = await admin.query(`SELECT name FROM products LIMIT 1`)
  const sample = rows[0]?.name
  if (sample) {
    const persian = /[؀-ۿ]/.test(sample)
    console.log(`  encoding:        ${persian ? '✓ Persian intact' : '✗ MOJIBAKE'} — "${sample}"`)
    if (!persian) failed = true
  }

  if (Number(tables) === 0 || Number(counts.settings) === 0) {
    console.error('\n✗ Restore produced an empty or partial database.')
    failed = true
  }
} catch (error) {
  console.error('\n✗ Restore FAILED:', error.message)
  failed = true
} finally {
  await admin.end()
}

console.log(failed ? '\n✗ Drill failed.\n' : '\n✓ Drill passed — this dump restores.\n')
process.exit(failed ? 1 : 0)
