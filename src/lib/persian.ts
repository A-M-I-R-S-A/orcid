const CHAR_FOLD: Record<string, string> = {
  'ي': 'ی',
  'ى': 'ی',
  'ے': 'ی',
  'ك': 'ک',
  'ة': 'ه',
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ٱ': 'ا',
  'ؤ': 'و',
  'ئ': 'ی',
}

const DIGIT_FOLD: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const

const STRIP_MARKS = /[ً-ٰٟـ‍‎‏﻿]/g

const ZWNJ = /‌/g

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
    .replace(/[.,;:!?()[\]{}"'«»„“”‘’/\\|~`@#$%^&*_+=<>–—؟،؛]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]!)
}

export function toLatinDigits(input: string): string {
  let out = ''
  for (const ch of String(input)) out += DIGIT_FOLD[ch] ?? ch
  return out
}

export function normalizePhone(raw: string): string | null {
  if (!raw) return null

  let s = toLatinDigits(String(raw)).replace(/[\s\-()]/g, '')

  if (s.startsWith('+98')) s = '0' + s.slice(3)
  else if (s.startsWith('0098')) s = '0' + s.slice(4)
  else if (s.startsWith('98') && s.length === 12) s = '0' + s.slice(2)
  else if (s.startsWith('9') && s.length === 10) s = '0' + s

  return /^09\d{9}$/.test(s) ? s : null
}

export function maskPhone(phone: string): string {
  if (phone.length !== 11) return phone
  return toPersianDigits(phone.slice(0, 4)) + '***' + toPersianDigits(phone.slice(7))
}

export function normalizePostalCode(raw: string): string | null {
  const s = toLatinDigits(String(raw)).replace(/[\s\-]/g, '')
  return /^\d{10}$/.test(s) ? s : null
}

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

export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => '\\' + c)
}
