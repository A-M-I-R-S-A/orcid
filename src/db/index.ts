import 'server-only'

import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

import * as schema from './schema'

/**
 * Connection pool.
 *
 * The pool is PER NODE WORKER, and managed hosting runs several workers. A
 * default of 10 across four workers is 40 connections — past the
 * max_user_connections ceiling common on shared plans, at which point the site
 * starts returning database errors under exactly the load you wanted.
 *
 * Keep DB_POOL_SIZE small (3–5) and confirm the host's ceiling before raising
 * it. Planning package §L.
 */
const POOL_SIZE = Math.max(1, Math.min(Number(process.env.DB_POOL_SIZE ?? 4), 10))

declare global {
  // eslint-disable-next-line no-var
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

    // BIGINT columns must not silently lose precision through JS numbers.
    // Every money and id column in this schema is BIGINT, so this matters:
    // values that fit in a safe integer come back as numbers, larger ones as
    // strings rather than as a wrong number.
    supportBigNumbers: true,
    bigNumberStrings: false,

    // Amounts are integers in Toman; DECIMAL is not used anywhere, but if a
    // future column adds one we want a string, not a lossy float.
    decimalNumbers: false,
  })
}

// Re-used across hot reloads in development so `next dev` does not leak pools.
const pool = globalThis.__orchidPool ?? createPool()
if (process.env.NODE_ENV !== 'production') globalThis.__orchidPool = pool

export const db = drizzle(pool, { schema, mode: 'default' })
export { pool, schema }

export type Database = typeof db

/**
 * Runs `fn` inside a transaction. Every multi-row invariant in this
 * application — stock decrement at checkout, payment approval, order status
 * transitions — goes through here rather than issuing loose statements.
 */
export async function transaction<T>(fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>): Promise<T> {
  return db.transaction(fn) as Promise<T>
}

/**
 * Reads `affectedRows` from a Drizzle mysql2 write.
 *
 * ── Why this helper exists ─────────────────────────────────────────────────
 * `db.update()` / `db.delete()` resolve to mysql2's raw shape,
 * `[ResultSetHeader, FieldPacket[]]` — an ARRAY. Reading `result.affectedRows`
 * off it yields `undefined`, not a count.
 *
 * That is not a cosmetic mistake. Several guards in this codebase are written
 * as "the conditional UPDATE affected zero rows, so the precondition failed":
 * the checkout stock decrement, the OTP single-use consumption, the payment
 * approval race check. With `undefined ?? 0` every one of those reads as zero,
 * so the guard fires on the happy path — checkout would reject every order as
 * out of stock.
 *
 * Insert is different and was always correct: `const [inserted] = await
 * db.insert(...)` destructures the header directly, so `inserted.insertId`
 * works.
 *
 * Integration tests against a real MariaDB caught this; no mock would have.
 */
export function affectedRows(result: unknown): number {
  // [ResultSetHeader, FieldPacket[]] — the normal shape.
  if (Array.isArray(result)) {
    const header = result[0] as { affectedRows?: number } | undefined
    return header?.affectedRows ?? 0
  }
  // Inside a transaction some drivers hand back the header directly.
  return (result as { affectedRows?: number })?.affectedRows ?? 0
}
