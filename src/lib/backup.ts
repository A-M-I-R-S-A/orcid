import 'server-only'

import { createGzip } from 'node:zlib'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'

import mysql from 'mysql2/promise'

import { uploadRoot } from './images'
import { logger } from './logger'

interface RawQueryable {
  query: (sql: string) => { stream: () => NodeJS.ReadableStream }
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (Buffer.isBuffer(value) || value instanceof Date) return mysql.escape(value)
  if (typeof value === 'object') return mysql.escape(JSON.stringify(value))
  return mysql.escape(value as never)
}

const KEEP = 14
const PREFIX = 'orchid-'

function backupDir(): string {
  return process.env.BACKUP_DIR ?? path.join(uploadRoot(), 'backups')
}

export interface BackupResult {
  file: string
  bytes: number
  tables: number
  rows: number
  durationMs: number
}

export async function dumpDatabase(): Promise<BackupResult> {
  const started = Date.now()
  const dir = backupDir()
  await mkdir(dir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = path.join(dir, `${PREFIX}${stamp}.sql.gz`)

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    dateStrings: true,
  })

  let tables = 0
  let rows = 0

  try {
    await connection.query("SET time_zone = '+00:00'")
    await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT')

    const [tableRows] = (await connection.query(
      `SELECT table_name AS name FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
    )) as unknown as [{ name: string }[], unknown]

    async function* generate(): AsyncGenerator<string> {
      yield `-- Orchid logical backup\n-- ${new Date().toISOString()}\n`
      yield `SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\nSET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n`

      for (const { name } of tableRows) {
        tables++

        const [create] = (await connection.query(
          `SHOW CREATE TABLE \`${name}\``,
        )) as unknown as [Record<string, string>[], unknown]

        yield `DROP TABLE IF EXISTS \`${name}\`;\n${create[0]!['Create Table']};\n`

        const raw = (connection as unknown as { connection: RawQueryable }).connection
        const stream = raw.query(`SELECT * FROM \`${name}\``).stream()

        let batch: string[] = []
        let columns: string[] | null = null

        for await (const row of stream as AsyncIterable<Record<string, unknown>>) {
          columns ??= Object.keys(row)
          batch.push(`(${columns.map((c) => literal(row[c])).join(",")})`)
          rows++

          if (batch.length >= 200) {
            yield `INSERT INTO \`${name}\` (${columns.map((c) => `\`${c}\``).join(',')}) VALUES\n${batch.join(',\n')};\n`
            batch = []
          }
        }

        if (batch.length > 0 && columns) {
          yield `INSERT INTO \`${name}\` (${columns.map((c) => `\`${c}\``).join(',')}) VALUES\n${batch.join(',\n')};\n`
        }

        yield '\n'
      }

      yield 'SET FOREIGN_KEY_CHECKS = 1;\n'
    }

    await pipeline(Readable.from(generate()), createGzip({ level: 6 }), createWriteStream(file))
    await connection.query('COMMIT')
  } finally {
    await connection.end()
  }

  const { size } = await stat(file)
  await prune(dir)

  const result = { file, bytes: size, tables, rows, durationMs: Date.now() - started }
  logger.info('database backup written', result)

  return result
}

async function prune(dir: string): Promise<void> {
  const entries = (await readdir(dir))
    .filter((name) => name.startsWith(PREFIX) && name.endsWith('.sql.gz'))
    .sort()
    .reverse()

  for (const stale of entries.slice(KEEP)) {
    await unlink(path.join(dir, stale)).catch(() => {})
  }
}

export async function backupAgeHours(): Promise<number | null> {
  try {
    const dir = backupDir()
    const entries = (await readdir(dir))
      .filter((name) => name.startsWith(PREFIX) && name.endsWith('.sql.gz'))
      .sort()

    const newest = entries[entries.length - 1]
    if (!newest) return null

    const { mtimeMs } = await stat(path.join(dir, newest))
    return (Date.now() - mtimeMs) / 3_600_000
  } catch {
    return null
  }
}
