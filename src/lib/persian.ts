/**
 * Persian text utilities.
 *
 * The single most important function here is `normalizePersian`. It is used in
 * exactly two places — building `products.search_text` at write time, and
 * normalising the incoming query at read time. Because it is ONE function used
 * on both sides, the index and the query can never drift apart, which is the
 * failure mode §18 warns about.
 */

/* ── Character folding tables ───────────────────────────────────────────── */

/**
 * Arabic forms that Persian keyboards and copy-pasted text produce
 * interchangeably. No MariaDB collation folds these reliably, which is why we
 * normalise in application code. Planning package §D-2.
 */
const CHAR_FOLD: Record<string, string> = {
  // Arabic Yeh / Alef Maksura → Persian Yeh
  'ي': 'ی', // ي
  'ى': 'ی', // ى
  'ے': 'ی', // ے
  // Arabic Kaf → Persian Keheh
  'ك': 'ک', // ك
  // Teh Marbuta → Heh
  'ة': 'ه', // ة
  // Hamza-carrying Alefs → bare Alef
  'أ': 'ا', // أ
  'إ': 'ا', // إ
  'آ': 'ا', // آ
  'ٱ': 'ا', // ٱ
  // Waw with hamza → Waw
  'ؤ': 'و', // ؤ
  // Yeh with hamza → Yeh
  'ئ': 'ی', // ئ
}

/** Arabic-Indic and extended (Persian) digits → ASCII. */
const DIGIT_FOLD: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const

/** Harakat, tatweel and the zero-width marks that break naive matching. */
const STRIP_MARKS = /[ً-ٰٟـ‍‎‏﻿]/g

/** Zero-width non-joiner. Splits Persian compounds inconsistently by writer. */
const ZWNJ = /‌/g

/**
 * Folds a Persian/Arabic string into a stable, searchable form.
 *
 * ZWNJ becomes a space rather than being deleted: "می‌روم" and "می روم" then
 * agree, and both tokenise into words a FULLTEXT index can find. Deleting it
 * instead would produce "میروم", which matches neither of the ways a customer
 * actually types it.
 */
export function normalizePersian(input: string): string {
  if (!input) return ''

  let out = input.normalize('NFC')

  out = out.replace(ZWNJ, ' ')
  out = out.replace(STRIP_MARKS, '')

  let folded = ''
  for (const ch of out) {
    folded += CHAR_FOLD[ch] ?? DIGIT_FOLD[ch] ?? ch
  }

  return folded
    .toLowerCase()
    // Punctuation, Persian and Latin alike, becomes a separator.
    .replace(/[.,;:!?()[\]{}"'«»„“”‘’/\\|~`@#$%^&*_+=<>–—؟،؛]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Latin digits → Persian, for display in prose and prices. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]!)
}

/**
 * Persian/Arabic digits → Latin. Applied to EVERY numeric form field before
 * validation — a customer typing a phone number on a Persian keyboard produces
 * ۰۹۱۲…, which must not be rejected as invalid.
 */
export function toLatinDigits(input: string): string {
  let out = ''
  for (const ch of String(input)) out += DIGIT_FOLD[ch] ?? ch
  return out
}

/* ── Phone numbers ──────────────────────────────────────────────────────── */

/**
 * Canonicalises an Iranian mobile number to 11 digits with a leading zero.
 * Accepts +98…, 0098…, 98…, 9…, Persian digits, spaces and dashes.
 * Returns null when the input is not a valid Iranian mobile number.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null

  let s = toLatinDigits(String(raw)).replace(/[\s\-()]/g, '')

  if (s.startsWith('+98')) s = '0' + s.slice(3)
  else if (s.startsWith('0098')) s = '0' + s.slice(4)
  else if (s.startsWith('98') && s.length === 12) s = '0' + s.slice(2)
  else if (s.startsWith('9') && s.length === 10) s = '0' + s

  return /^09\d{9}$/.test(s) ? s : null
}

/** Masks a phone for display: 09121234567 → ۰۹۱۲***۴۵۶۷ */
export function maskPhone(phone: string): string {
  if (phone.length !== 11) return phone
  return toPersianDigits(phone.slice(0, 4)) + '***' + toPersianDigits(phone.slice(7))
}

/* ── Postal code ────────────────────────────────────────────────────────── */

export function normalizePostalCode(raw: string): string | null {
  const s = toLatinDigits(String(raw)).replace(/[\s\-]/g, '')
  return /^\d{10}$/.test(s) ? s : null
}

/* ── Search tokenisation ────────────────────────────────────────────────── */

/**
 * Splits a normalised query into tokens usable in a boolean FULLTEXT search.
 *
 * `shortTokens` are the ones below MariaDB's minimum token length — those are
 * invisible to FULLTEXT and must be handled by a LIKE fallback instead of
 * silently returning nothing. Planning §D-2.
 */
export function tokenizeQuery(query: string, minTokenLength = 3) {
  const normalized = normalizePersian(query)
  const all = normalized.split(' ').filter(Boolean).slice(0, 12)

  return {
    normalized,
    tokens: all,
    indexTokens: all.filter((t) => t.length >= minTokenLength),
    shortTokens: all.filter((t) => t.length < minTokenLength),
  }
}

/** Escapes the characters that carry meaning inside a LIKE pattern. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => '\\' + c)
}
