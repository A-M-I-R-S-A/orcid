import { describe, expect, it } from 'vitest'

import * as crypto from '@/lib/crypto'

describe('generateOtp', () => {
  it('produces a six-digit string', () => {
    for (let i = 0; i < 200; i++) {
      expect(crypto.generateOtp()).toMatch(/^\d{6}$/)
    }
  })

  it('pads leading zeros rather than shortening the code', () => {
    const codes = Array.from({ length: 500 }, () => crypto.generateOtp())
    expect(codes.every((c) => c.length === 6)).toBe(true)
  })

  it('does not repeat trivially', () => {
    const codes = new Set(Array.from({ length: 200 }, () => crypto.generateOtp()))
    expect(codes.size).toBeGreaterThan(150)
  })
})

describe('OTP hashing', () => {
  const phone = '09121234567'

  it('verifies a correct code', () => {
    const code = '123456'
    const hash = crypto.hashOtp(code, phone)
    expect(crypto.verifyOtpHash(code, phone, hash)).toBe(true)
  })

  it('rejects a wrong code', () => {
    const hash = crypto.hashOtp('123456', phone)
    expect(crypto.verifyOtpHash('123457', phone, hash)).toBe(false)
  })

  it('binds the hash to the phone number', () => {
    const hash = crypto.hashOtp('123456', phone)
    expect(crypto.verifyOtpHash('123456', '09121234568', hash)).toBe(false)
  })

  it('never stores the code in recoverable form', () => {
    const hash = crypto.hashOtp('123456', phone)
    expect(hash).not.toContain('123456')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('rejects a malformed stored hash without throwing', () => {
    expect(crypto.verifyOtpHash('123456', phone, 'garbage')).toBe(false)
    expect(crypto.verifyOtpHash('123456', phone, '')).toBe(false)
  })
})

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const hash = await crypto.hashPassword('correct horse battery staple')
    expect(await crypto.verifyPassword('correct horse battery staple', hash)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await crypto.hashPassword('correct horse battery staple')
    expect(await crypto.verifyPassword('wrong password entirely', hash)).toBe(false)
  })

  it('salts — the same password hashes differently each time', async () => {
    const a = await crypto.hashPassword('same password')
    const b = await crypto.hashPassword('same password')
    expect(a).not.toBe(b)
  })

  it('encodes its parameters so they can be raised later', async () => {
    const hash = await crypto.hashPassword('x')
    expect(hash).toMatch(/^scrypt:\d+:\d+:\d+:[0-9a-f]+:[0-9a-f]+$/)
  })

  it('rejects a malformed stored hash without throwing', async () => {
    expect(await crypto.verifyPassword('x', 'not-a-hash')).toBe(false)
    expect(await crypto.verifyPassword('x', 'scrypt:bad')).toBe(false)
  })
})

describe('secret encryption', () => {
  it('round-trips a value', () => {
    const secret = 'sms-ir-api-key-abcdef123456'
    const encrypted = crypto.encryptSecret(secret)
    expect(crypto.decryptSecret(encrypted)).toBe(secret)
  })

  it('does not leave the plaintext visible in the ciphertext', () => {
    const encrypted = crypto.encryptSecret('sms-ir-api-key-abcdef123456')
    expect(encrypted).not.toContain('abcdef123456')
  })

  it('produces different ciphertext each time (random IV)', () => {
    const a = crypto.encryptSecret('same value')
    const b = crypto.encryptSecret('same value')
    expect(a).not.toBe(b)
    expect(crypto.decryptSecret(a)).toBe(crypto.decryptSecret(b))
  })

  it('detects tampering — GCM authenticates', () => {
    const encrypted = crypto.encryptSecret('sensitive')
    const parts = encrypted.split(':')
    const body = parts[parts.length - 1]!
    const tampered = [...parts.slice(0, -1), body.slice(0, -2) + (body.endsWith('A') ? 'B' : 'A') + '='].join(':')

    expect(() => crypto.decryptSecret(tampered)).toThrow()
  })

  it('rejects a value that is not an encrypted secret', () => {
    expect(() => crypto.decryptSecret('plaintext')).toThrow()
  })

  it('identifies encrypted values', () => {
    expect(crypto.isEncrypted(crypto.encryptSecret('x'))).toBe(true)
    expect(crypto.isEncrypted('plaintext')).toBe(false)
    expect(crypto.isEncrypted(null)).toBe(false)
  })

  it('masks a secret without revealing it', () => {
    const masked = crypto.maskSecret('abcdefghijklmnop')
    expect(masked).not.toContain('abcdefghijkl')
    expect(masked).toContain('mnop')
    expect(crypto.maskSecret('short')).toBe('••••••••')
  })
})

describe('session tokens', () => {
  it('generates high-entropy, URL-safe tokens', () => {
    const token = crypto.generateToken()
    expect(token.length).toBeGreaterThanOrEqual(40)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('does not repeat', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => crypto.generateToken()))
    expect(tokens.size).toBe(500)
  })

  it('hashes deterministically for storage', () => {
    const token = crypto.generateToken()
    expect(crypto.hashToken(token)).toBe(crypto.hashToken(token))
    expect(crypto.hashToken(token)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('CSRF tokens', () => {
  it('verifies a token derived from the same session', () => {
    const session = crypto.generateToken()
    expect(crypto.verifyCsrfToken(session, crypto.signCsrfToken(session))).toBe(true)
  })

  it('rejects a token from a different session', () => {
    const a = crypto.generateToken()
    const b = crypto.generateToken()
    expect(crypto.verifyCsrfToken(a, crypto.signCsrfToken(b))).toBe(false)
  })

  it('rejects an empty or malformed token without throwing', () => {
    const session = crypto.generateToken()
    expect(crypto.verifyCsrfToken(session, '')).toBe(false)
    expect(crypto.verifyCsrfToken(session, 'nope')).toBe(false)
  })
})
