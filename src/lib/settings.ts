import 'server-only'

import { eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { settings, settingsVersion } from '@/db/schema'
import { decryptSecret, encryptSecret, isEncrypted } from './crypto'

/**
 * Settings — typed key/value, namespaced, cached.
 *
 * Theme, typography, SEO defaults, Enamad, SMS credentials and Torob Pay all
 * live in one table, so there is one mechanism, one cache and one audit trail
 * rather than eight near-identical single-row tables.
 *
 * ── Cache coherence without Redis ──────────────────────────────────────────
 * These rows are read on essentially every request, so they cannot hit the
 * database each time. But managed hosting runs several Node workers, and an
 * in-process cache in worker 1 does not know that an admin just saved a new
 * colour through worker 3.
 *
 * Resolution: cache per process behind a short TTL, and have every write bump
 * `settings_version`. The writing worker clears its own cache immediately;
 * other workers converge within the TTL. A colour change taking up to 30
 * seconds to reach every visitor is an acceptable trade — which is exactly why
 * prices and stock are NEVER cached this way. Planning package §C.
 */

const CACHE_TTL_MS = 30_000

export const NAMESPACES = [
  'site',
  'theme',
  'typography',
  'seo',
  'contact',
  'social',
  'shipping',
  'payment_card',
  'sms',
  'torob',
  'enamad',
] as const

export type Namespace = (typeof NAMESPACES)[number]

type SettingsMap = Record<string, string | null>

interface CacheEntry {
  data: Record<string, SettingsMap>
  loadedAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __orchidSettingsCache: CacheEntry | undefined
}

function now() {
  return Date.now()
}

async function loadAll(): Promise<Record<string, SettingsMap>> {
  let rows: { namespace: string; key: string; value: string | null }[]

  try {
    rows = await db
      .select({
        namespace: settings.namespace,
        key: settings.key,
        value: settings.value,
      })
      .from(settings)
  } catch (error) {
    /*
     * Settings — and ONLY settings — degrade to defaults when the database is
     * unreachable. Two reasons, both deliberate:
     *
     *  1. Graceful degradation. These rows are presentation config: colours,
     *     fonts, the site name, SEO defaults. A database blip should not turn
     *     the entire storefront into a 500; it should render in the
     *     specification palette while the database recovers.
     *
     *  2. A build with no database. The root layout reads the theme, so
     *     without this fallback NOTHING can be prerendered — not even the 404
     *     page — and `next build` requires a reachable MariaDB. The deployment
     *     plan builds off-host, where the production database is bound to
     *     localhost and unreachable. See lib/cache.ts.
     *
     * This must NEVER be extended to business data. Prices, stock, orders and
     * payments fail loudly by design — silently serving a default price would
     * be far worse than an error page.
     */
    console.error('Settings unavailable, falling back to defaults:', (error as Error).message)
    return {}
  }

  const out: Record<string, SettingsMap> = {}
  for (const row of rows) {
    const ns = (out[row.namespace] ??= {})
    // Secrets stay encrypted in the cache. Only getSecret() decrypts, and only
    // on the server — an accidental serialisation of this object leaks nothing.
    ns[row.key] = row.value
  }
  return out
}

async function getCache(): Promise<Record<string, SettingsMap>> {
  const cached = globalThis.__orchidSettingsCache
  if (cached && now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.data
  }

  const data = await loadAll()
  globalThis.__orchidSettingsCache = { data, loadedAt: now() }
  return data
}

/** Drops this worker's cache. Called after any write in this process. */
export function invalidateSettingsCache(): void {
  globalThis.__orchidSettingsCache = undefined
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

export async function getNamespace(namespace: Namespace): Promise<SettingsMap> {
  const cache = await getCache()
  return cache[namespace] ?? {}
}

export async function getSetting(
  namespace: Namespace,
  key: string,
  fallback = '',
): Promise<string> {
  const ns = await getNamespace(namespace)
  const value = ns[key]
  return value == null || value === '' ? fallback : value
}

export async function getBool(
  namespace: Namespace,
  key: string,
  fallback = false,
): Promise<boolean> {
  const raw = await getSetting(namespace, key, fallback ? '1' : '0')
  return raw === '1' || raw === 'true'
}

export async function getNumber(
  namespace: Namespace,
  key: string,
  fallback = 0,
): Promise<number> {
  const raw = await getSetting(namespace, key, String(fallback))
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export async function getJson<T>(namespace: Namespace, key: string, fallback: T): Promise<T> {
  const raw = await getSetting(namespace, key, '')
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * Decrypts a stored credential. SERVER ONLY — never call this from anything
 * whose return value reaches a client component.
 */
export async function getSecret(namespace: Namespace, key: string): Promise<string> {
  const ns = await getNamespace(namespace)
  const raw = ns[key]
  if (!raw) return ''

  if (!isEncrypted(raw)) {
    // Tolerated so a value seeded by hand still works, but it should not persist.
    console.warn(`Setting ${namespace}.${key} is marked secret but stored in plaintext`)
    return raw
  }

  try {
    return decryptSecret(raw)
  } catch (error) {
    console.error(`Failed to decrypt ${namespace}.${key}:`, (error as Error).message)
    return ''
  }
}

/** True when a credential is present, without decrypting or revealing it. */
export async function hasSecret(namespace: Namespace, key: string): Promise<boolean> {
  const ns = await getNamespace(namespace)
  return Boolean(ns[key])
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export async function setSetting(
  namespace: Namespace,
  key: string,
  value: string | null,
  options: { isSecret?: boolean } = {},
): Promise<void> {
  const isSecret = options.isSecret ?? false
  const stored = isSecret && value ? encryptSecret(value) : value

  await db
    .insert(settings)
    .values({ namespace, key, value: stored, isSecret })
    .onDuplicateKeyUpdate({ set: { value: stored, isSecret } })

  await bumpVersion()
  invalidateSettingsCache()
}

export async function setMany(
  namespace: Namespace,
  values: Record<string, string | null>,
  secretKeys: readonly string[] = [],
): Promise<void> {
  const secrets = new Set(secretKeys)

  for (const [key, value] of Object.entries(values)) {
    const isSecret = secrets.has(key)

    // An empty value for a secret means "leave the existing credential alone" —
    // the admin form shows a mask, so a blank field is "unchanged", not "clear".
    if (isSecret && !value) continue

    const stored = isSecret && value ? encryptSecret(value) : value
    await db
      .insert(settings)
      .values({ namespace, key, value: stored, isSecret })
      .onDuplicateKeyUpdate({ set: { value: stored, isSecret } })
  }

  await bumpVersion()
  invalidateSettingsCache()
}

/** Explicitly clears a credential. Distinct from "left the field blank". */
export async function clearSecret(namespace: Namespace, key: string): Promise<void> {
  await db
    .update(settings)
    .set({ value: null })
    .where(sql`${settings.namespace} = ${namespace} AND ${settings.key} = ${key}`)

  await bumpVersion()
  invalidateSettingsCache()
}

async function bumpVersion(): Promise<void> {
  await db
    .insert(settingsVersion)
    .values({ id: 1, version: 1 })
    .onDuplicateKeyUpdate({ set: { version: sql`${settingsVersion.version} + 1` } })
}

export async function getVersion(): Promise<number> {
  const [row] = await db
    .select({ version: settingsVersion.version })
    .from(settingsVersion)
    .where(eq(settingsVersion.id, 1))
    .limit(1)
  return row?.version ?? 0
}
