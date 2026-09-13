#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import mysql from 'mysql2/promise'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = path.join(ROOT, 'drizzle')
const LOCK_NAME = 'orchid_migrations'
const LOCK_TIMEOUT_SEC = 30

const dryRun = process.argv.includes('--dry-run')

function required(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`✗ Missing environment variable ${name}. See .env.example.`)
    process.exit(1)
  }
  return value
}

function checksum(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 32)
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME'),
    multipleStatements: false,
    charset: 'utf8mb4_unicode_ci',
  })

  try {
    await connection.query("SET SESSION default_storage_engine = 'InnoDB'")

    const [[versionRow]] = await connection.query('SELECT VERSION() AS version')
    console.log(`→ Connected to ${versionRow.version}`)

    const [[lockRow]] = await connection.query('SELECT GET_LOCK(?, ?) AS acquired', [
      LOCK_NAME,
      LOCK_TIMEOUT_SEC,
    ])

    if (lockRow.acquired !== 1) {
      console.error('✗ Another migration run holds the lock. Aborting.')
      process.exit(1)
    }

    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS __orchid_migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_filename (filename)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)

      const [appliedRows] = await connection.query(
        'SELECT filename, checksum FROM __orchid_migrations',
      )
      const applied = new Map(appliedRows.map((r) => [r.filename, r.checksum]))

      const files = (await readdir(MIGRATIONS_DIR))
        .filter((f) => f.endsWith('.sql'))
        .sort()

      if (files.length === 0) {
        console.log('→ No migration files found.')
        return
      }

      let pending = 0

      for (const filename of files) {
        const content = await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8')
        const sum = checksum(content)
        const previous = applied.get(filename)

        if (previous) {
          if (previous !== sum) {
            console.error(
              `\n✗ ${filename} has been modified since it was applied.\n` +
                `  expected checksum ${previous}, file is ${sum}\n\n` +
                `  Never edit an applied migration. Add a new one instead.\n`,
            )
            process.exit(1)
          }
          continue
        }

        pending++

        if (dryRun) {
          console.log(`  would apply  ${filename}`)
          continue
        }

        console.log(`→ Applying ${filename}`)

        const statements = content
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !/^(--[^\n]*\n?)+$/.test(s))

        for (const [index, statement] of statements.entries()) {
          try {
            await connection.query(statement)
          } catch (error) {
            console.error(
              `\n✗ ${filename} failed at statement ${index + 1}/${statements.length}:\n` +
                `\n${statement.slice(0, 500)}\n\n` +
                `  ${error.code ?? ''} ${error.message}\n\n` +
                `  DDL is not transactional in MySQL/MariaDB — this migration is\n` +
                `  PARTIALLY applied and is NOT recorded. Fix the cause, undo any\n` +
                `  statements that did succeed, then re-run.\n`,
            )
            process.exit(1)
          }
        }

        await connection.query(
          'INSERT INTO __orchid_migrations (filename, checksum) VALUES (?, ?)',
          [filename, sum],
        )

        console.log(`  ✓ ${filename} (${statements.length} statements)`)
      }

      if (pending === 0) {
        console.log('→ Database is up to date.')
      } else if (dryRun) {
        console.log(`\n→ ${pending} migration(s) pending. Nothing was applied (--dry-run).`)
      } else {
        console.log(`\n✓ Applied ${pending} migration(s).`)
      }
    } finally {
      await connection.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME])
    }
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error('✗ Migration failed:', error.message)
  process.exit(1)
})
