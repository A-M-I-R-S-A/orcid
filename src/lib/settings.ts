import 'server-only'

import { eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { settings, settingsVersion } from '@/db/schema'
import { decryptSecret, encryptSecret, isEncrypted } from './crypto'

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
    console.error('Settings unavailable, falling back to defaults:', (error as Error).message)
    return {}
  }

  const out: Record<string, SettingsMap> = {}
  for (const row of rows) {
    const ns = (out[row.namespace] ??= {})
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

export function invalidateSettingsCache(): void {
  globalThis.__orchidSettingsCache = undefined
}

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

export async function getSecret(namespace: Namespace, key: string): Promise<string> {
  const ns = await getNamespace(namespace)
  const raw = ns[key]
  if (!raw) return ''

  if (!isEncrypted(raw)) {
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

export async function hasSecret(namespace: Namespace, key: string): Promise<boolean> {
  const ns = await getNamespace(namespace)
  return Boolean(ns[key])
}

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
