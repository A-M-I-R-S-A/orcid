import { describe, expect, it } from 'vitest'

import { excerpt, parseFaq, splitLead, toPlainText } from '@/lib/rich-text'

describe('toPlainText', () => {
  it('strips tags and decodes entities', () => {
    expect(toPlainText('<p>سلام <strong>دنیا</strong>&nbsp;&amp; بیشتر</p>')).toBe(
      'سلام دنیا & بیشتر',
    )
  })

  it('collapses whitespace', () => {
    expect(toPlainText('<p>a</p>\n\n<p>b</p>')).toBe('a b')
  })
})

describe('splitLead', () => {
  it('pulls the first paragraph out as plain text', () => {
    const { lead, rest } = splitLead('<p>مقدمه</p><p>ادامه</p>')
    expect(lead).toBe('مقدمه')
    expect(rest).toBe('<p>ادامه</p>')
  })

  it('leaves the body untouched when it does not start with a paragraph', () => {
    const html = '<h2>عنوان</h2><p>متن</p>'
    expect(splitLead(html)).toEqual({ lead: '', rest: html })
  })

  it('ignores an empty first paragraph', () => {
    const html = '<p>  </p><p>متن</p>'
    expect(splitLead(html).lead).toBe('')
  })
})

describe('parseFaq', () => {
  it('returns no groups for bodies without headings', () => {
    const result = parseFaq('<p>فقط متن</p>')
    expect(result.groups).toEqual([])
    expect(result.intro).toBe('<p>فقط متن</p>')
  })

  it('treats a single heading level as questions', () => {
    const result = parseFaq('<h2>پرسش یک</h2><p>پاسخ یک</p><h2>پرسش دو</h2><p>پاسخ دو</p>')

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]!.title).toBeNull()
    expect(result.groups[0]!.items).toEqual([
      { question: 'پرسش یک', answer: '<p>پاسخ یک</p>' },
      { question: 'پرسش دو', answer: '<p>پاسخ دو</p>' },
    ])
  })

  it('uses h2 as a category when h3 questions exist', () => {
    const result = parseFaq(
      '<h2>سایز</h2><p>مقدمه دسته</p><h3>چطور سایز بگیرم؟</h3><p>پاسخ</p><h2>ارسال</h2><h3>چند روز؟</h3><p>سه روز</p>',
    )

    expect(result.groups.map((group) => group.title)).toEqual(['سایز', 'ارسال'])
    expect(result.groups[0]!.intro).toBe('<p>مقدمه دسته</p>')
    expect(result.groups[0]!.items[0]!.question).toBe('چطور سایز بگیرم؟')
    expect(result.groups[1]!.items[0]!.answer).toBe('<p>سه روز</p>')
  })

  it('keeps content before the first question as the intro', () => {
    const result = parseFaq('<p>پیش‌درآمد</p><h2>پرسش</h2><p>پاسخ</p>')
    expect(result.intro).toBe('<p>پیش‌درآمد</p>')
  })

  it('drops categories that hold no questions', () => {
    const result = parseFaq('<h2>خالی</h2><h2>سایز</h2><h3>پرسش</h3><p>پاسخ</p>')
    expect(result.groups.map((group) => group.title)).toEqual(['سایز'])
  })

  it('strips markup from question text', () => {
    const result = parseFaq('<h2><strong>پرسش</strong> مهم</h2><p>پاسخ</p>')
    expect(result.groups[0]!.items[0]!.question).toBe('پرسش مهم')
  })
})

describe('excerpt', () => {
  it('returns short text unchanged', () => {
    expect(excerpt('<p>کوتاه</p>')).toBe('کوتاه')
  })

  it('truncates on a word boundary', () => {
    const result = excerpt(`<p>${'کلمه '.repeat(60)}</p>`, 40)
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(41)
  })
})
