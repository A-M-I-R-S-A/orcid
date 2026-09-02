import 'server-only'

import {
  type ScryptOptions,
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

/**
 * `promisify`'s inferred type only picks up scrypt's 3-argument overload, so
 * the options object is annotated explicitly rather than cast at each call.
 */
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>

/* ── Environment ────────────────────────────────────────────────────────── */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    )
  }
  return value
}

/* ── Tokens ─────────────────────────────────────────────────────────────── */

/** 256 bits of entropy, URL-safe. Used for session and cart tokens. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/**
 * Session tokens are stored hashed. A leaked database dump therefore does not
 * hand out live sessions — the plaintext exists only in the user's cookie.
 * SHA-256 is correct here (not a slow KDF): the input is already 256 bits of
 * entropy, so there is nothing to brute-force.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/* ── OTP ────────────────────────────────────────────────────────────────── */

/**
 * Cryptographically secure six-digit code.
 * `randomInt` is rejection-sampled by Node — `Math.random()` would be both
 * predictable and biased, and this value guards account access.
 */
export function generateOtp(digits = 6): string {
  const max = 10 ** digits
  return String(randomInt(0, max)).padStart(digits, '0')
}

/**
 * HMAC-SHA256 of the code under a server-held pepper.
 *
 * A plain hash of a six-digit code is trivially reversed — there are only a
 * million of them. The pepper lives in the environment, not the database, so a
 * dump alone yields nothing usable. §24: the code is never stored, logged, or
 * returned to the client in any form.
 */
export function hashOtp(code: string, phone: string): string {
  return createHmac('sha256', requireEnv('OTP_PEPPER'))
    .update(`${phone}:${code}`)
    .digest('hex')
}

/** Constant-time comparison. A fast-exit compare leaks the code by timing. */
export function verifyOtpHash(code: string, phone: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(code, phone), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

/* ── Passwords (admin only) ─────────────────────────────────────────────── */

const SCRYPT_N = 16384
const SCRYPT_r = 8
const SCRYPT_p = 1
const KEY_LEN = 64

/**
 * scrypt, from Node's standard library — no native dependency to fail on a
 * managed host, and memory-hard against GPU attack.
 * Encoded as "scrypt:N:r:p:saltHex:hashHex" so parameters can be raised later
 * without invalidating existing hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  })

  return `scrypt:${SCRYPT_N}:${SCRYPT_r}:${SCRYPT_p}:${salt.toString('hex')}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts
  const N = Number(nRaw)
  const r = Number(rRaw)
  const p = Number(pRaw)
  if (!N || !r || !p || !saltHex || !hashHex) return false

  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')

  const derived = await scrypt(password, salt, expected.length, { N, r, p })
  return timingSafeEqual(derived, expected)
}

/* ── Settings encryption ────────────────────────────────────────────────── */

/**
 * AES-256-GCM for provider credentials stored in the settings table.
 *
 * §25 requires the SMS.ir API key to be editable from the admin panel, so it
 * cannot live in the environment; §75 requires it not to sit in the database
 * in plaintext. Encrypting at rest with an environment-held master key
 * satisfies both: admins rotate credentials without a redeploy, and a database
 * dump on its own leaks nothing usable.
 *
 * GCM rather than CBC because it authenticates — a tampered ciphertext fails
 * loudly instead of decrypting to garbage that gets sent to a payment provider.
 */
function masterKey(): Buffer {
  const hex = requireEnv('ENCRYPTION_KEY')
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error(
      'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }
  return Buffer.from(hex, 'hex')
}

const ENC_PREFIX = 'enc:v1:'

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv)

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return ENC_PREFIX + [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) {
    throw new Error('Value is not an encrypted secret')
  }

  const [ivB64, tagB64, dataB64] = stored.slice(ENC_PREFIX.length).split(':')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted secret')
  }

  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX)
}

/**
 * What the admin UI shows in place of a stored credential. §47 — never render
 * the plaintext, even to a superadmin; offer a replace action instead.
 */
export function maskSecret(plaintext: string): string {
  if (!plaintext) return ''
  if (plaintext.length <= 8) return '••••••••'
  return '••••••••' + plaintext.slice(-4)
}

/* ── CSRF (route handlers) ──────────────────────────────────────────────── */

/**
 * Server Actions get origin validation from Next.js itself. Route handlers
 * that mutate state do not, so they use a double-submit token.
 */
export function signCsrfToken(sessionToken: string): string {
  return createHmac('sha256', requireEnv('SESSION_SECRET'))
    .update(sessionToken)
    .digest('base64url')
}

export function verifyCsrfToken(sessionToken: string, presented: string): boolean {
  const expected = Buffer.from(signCsrfToken(sessionToken))
  const actual = Buffer.from(presented ?? '')
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
