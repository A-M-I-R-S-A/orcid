import 'server-only'

import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

import * as schema from './schema'

const POOL_SIZE = Math.max(1, Math.min(Number(process.env.DB_POOL_SIZE ?? 4), 10))

declare global {
  var __orchidPool: mysql.Pool | undefined
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    connectionLimit: POOL_SIZE,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,

    charset: 'utf8mb4_unicode_ci',

    timezone: 'Z',

    supportBigNumbers: true,
    bigNumberStrings: false,

    decimalNumbers: false,
  })
}

function pinSessionToUtc(pool: mysql.Pool): mysql.Pool {
  pool.on('connection', (connection) => {
    const raw = connection as unknown as {
      query: (sql: string, cb: (error: unknown) => void) => unknown
    }

    raw.query("SET time_zone = '+00:00'", (error: unknown) => {
      if (error) {
        console.error('[db] could not pin session time zone to UTC:', error)
      }
    })
  })

  return pool
}

const pool = globalThis.__orchidPool ?? pinSessionToUtc(createPool())
if (process.env.NODE_ENV !== 'production') globalThis.__orchidPool = pool

export const db = drizzle(pool, { schema, mode: 'default' })
export { pool, schema }

export type Database = typeof db

export async function transaction<T>(fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>): Promise<T> {
  return db.transaction(fn) as Promise<T>
}

export function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    const header = result[0] as { affectedRows?: number } | undefined
    return header?.affectedRows ?? 0
  }
  return (result as { affectedRows?: number })?.affectedRows ?? 0
}
