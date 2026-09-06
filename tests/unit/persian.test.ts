import { describe, expect, it } from 'vitest'

import {
  escapeLike,
  maskPhone,
  normalizePersian,
  normalizePhone,
  normalizePostalCode,
  toLatinDigits,
  toPersianDigits,
  tokenizeQuery,
} from '@/lib/persian'

describe('normalizePersian', () => {
  it('folds Arabic Yeh to Persian Yeh', () => {
    expect(normalizePersian('مشكي')).toBe(
      normalizePersian('مشکی'),
    )
  })

  it('folds Arabic Kaf to Persian Keheh', () => {
    expect(normalizePersian('ك')).toBe('ک')
  })

  it('folds Teh Marbuta to Heh', () => {
    expect(normalizePersian('ة')).toBe('ه')
  })

  it('folds hamza-carrying alefs to bare alef', () => {
    expect(normalizePersian('آ')).toBe('ا')
    expect(normalizePersian('أ')).toBe('ا')
    expect(normalizePersian('إ')).toBe('ا')
  })

  it('turns ZWNJ into a space so both spellings agree', () => {
    const withZwnj = 'می‌روم'
    const withSpace = 'می روم'
    expect(normalizePersian(withZwnj)).toBe(normalizePersian(withSpace))
  })

  it('does not glue words together when removing ZWNJ', () => {
    const withZwnj = 'می‌روم'
    expect(normalizePersian(withZwnj)).toContain(' ')
  })

  it('strips harakat', () => {
    expect(normalizePersian('مَشکی')).toBe('مشکی')
  })

  it('maps Persian and Arabic-Indic digits to ASCII', () => {
    expect(normalizePersian('۷۵')).toBe('75')
    expect(normalizePersian('٧٥')).toBe('75')
  })

  it('collapses punctuation and whitespace', () => {
    expect(normalizePersian('  a,   b!!  ')).toBe('a b')
  })

  it('is idempotent', () => {
    const input = 'سوتين مشكي ۷۵'
    const once = normalizePersian(input)
    expect(normalizePersian(once)).toBe(once)
  })

  it('handles empty input', () => {
    expect(normalizePersian('')).toBe('')
  })
})

describe('digit conversion', () => {
  it('round-trips', () => {
    expect(toLatinDigits(toPersianDigits('09121234567'))).toBe('09121234567')
  })

  it('leaves non-digits alone', () => {
    expect(toPersianDigits('ORC-42')).toBe('ORC-۴۲')
  })
})

describe('normalizePhone', () => {
  it.each([
    ['09121234567', '09121234567'],
    ['+989121234567', '09121234567'],
    ['00989121234567', '09121234567'],
    ['989121234567', '09121234567'],
    ['9121234567', '09121234567'],
    ['0912 123 4567', '09121234567'],
    ['0912-123-4567', '09121234567'],
    ['۰۹۱۲۱۲۳۴۵۶۷', '09121234567'],
  ])('normalises %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each([['08121234567'], ['0912123456'], ['091212345678'], ['abc'], ['']])(
    'rejects %s',
    (input) => {
      expect(normalizePhone(input)).toBeNull()
    },
  )
})

describe('maskPhone', () => {
  it('hides the middle digits', () => {
    const masked = maskPhone('09121234567')
    expect(masked).toContain('***')
    expect(masked).not.toContain('123')
  })
})

describe('normalizePostalCode', () => {
  it('accepts ten digits, including Persian ones', () => {
    expect(normalizePostalCode('1234567890')).toBe('1234567890')
    expect(normalizePostalCode('12345-67890')).toBe('1234567890')
  })

  it('rejects the wrong length', () => {
    expect(normalizePostalCode('12345')).toBeNull()
  })
})

describe('tokenizeQuery', () => {
  it('separates tokens too short for a FULLTEXT index', () => {
    const r = tokenizeQuery('ab abcd', 3)
    expect(r.shortTokens).toEqual(['ab'])
    expect(r.indexTokens).toEqual(['abcd'])
  })

  it('normalises before tokenising', () => {
    const r = tokenizeQuery('مشكي')
    expect(r.normalized).toBe('مشکی')
  })

  it('caps token count so a pathological query cannot build a huge clause', () => {
    const r = tokenizeQuery(Array.from({ length: 50 }, (_, i) => `tok${i}`).join(' '))
    expect(r.tokens.length).toBeLessThanOrEqual(12)
  })
})

describe('escapeLike', () => {
  it('escapes wildcards so user input cannot widen the match', () => {
    expect(escapeLike('100%')).toBe('100\\%')
    expect(escapeLike('a_b')).toBe('a\\_b')
  })
})
