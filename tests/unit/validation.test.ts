import { describe, expect, it } from 'vitest'

import {
  addToCartSchema,
  amountSchema,
  checkoutSchema,
  fieldErrors,
  formToObject,
  navHrefSchema,
  navLinkSchema,
  otpCodeSchema,
  paymentReferenceSchema,
  phoneSchema,
  postalCodeSchema,
  quantitySchema,
  reviewSchema,
  searchParamsSchema,
} from '@/lib/validation'

describe('phoneSchema', () => {
  it('accepts Persian digits', () => {
    const result = phoneSchema.safeParse('۰۹۱۲۱۲۳۴۵۶۷')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('09121234567')
  })

  it('normalises international forms', () => {
    for (const input of ['+989121234567', '00989121234567', '9121234567']) {
      const result = phoneSchema.safeParse(input)
      expect(result.success, input).toBe(true)
      if (result.success) expect(result.data).toBe('09121234567')
    }
  })

  it('rejects a landline', () => {
    expect(phoneSchema.safeParse('02112345678').success).toBe(false)
  })

  it('gives a Persian error message', () => {
    const result = phoneSchema.safeParse('nope')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]!.message).toMatch(/[؀-ۿ]/)
    }
  })
})

describe('otpCodeSchema', () => {
  it('accepts Persian digits', () => {
    const result = otpCodeSchema.safeParse('۱۲۳۴۵۶')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('123456')
  })

  it('rejects the wrong length', () => {
    expect(otpCodeSchema.safeParse('12345').success).toBe(false)
    expect(otpCodeSchema.safeParse('1234567').success).toBe(false)
  })

  it('rejects letters', () => {
    expect(otpCodeSchema.safeParse('12345a').success).toBe(false)
  })
})

describe('postalCodeSchema', () => {
  it('accepts ten Persian digits with a separator', () => {
    const result = postalCodeSchema.safeParse('۱۲۳۴۵-۶۷۸۹۰')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('1234567890')
  })

  it('rejects nine digits', () => {
    expect(postalCodeSchema.safeParse('123456789').success).toBe(false)
  })
})

describe('amountSchema', () => {
  it('strips thousand separators, Latin and Persian', () => {
    const result = amountSchema.safeParse('1,250,000')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(1_250_000)
  })

  it('accepts Persian digits', () => {
    const result = amountSchema.safeParse('۱۲۵۰۰۰')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe(125_000)
  })

  it('rejects a negative amount', () => {
    expect(amountSchema.safeParse(-5).success).toBe(false)
  })

  it('rejects a fractional amount — money is an integer here', () => {
    expect(amountSchema.safeParse('100.5').success).toBe(false)
  })
})

describe('quantitySchema', () => {
  it('accepts a sensible quantity', () => {
    expect(quantitySchema.safeParse('۳').success).toBe(true)
  })

  it('rejects zero and negatives', () => {
    expect(quantitySchema.safeParse(0).success).toBe(false)
    expect(quantitySchema.safeParse(-1).success).toBe(false)
  })

  it('caps at 99 so a typo cannot order 100000 items', () => {
    expect(quantitySchema.safeParse(100).success).toBe(false)
  })
})

describe('addToCartSchema', () => {
  it('defaults the quantity to one', () => {
    const result = addToCartSchema.safeParse({ variantId: 5 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.quantity).toBe(1)
  })

  it('rejects a non-positive variant id', () => {
    expect(addToCartSchema.safeParse({ variantId: 0 }).success).toBe(false)
    expect(addToCartSchema.safeParse({ variantId: -3 }).success).toBe(false)
  })
})

describe('checkoutSchema', () => {
  const valid = {
    fullName: 'مریم احمدی',
    phone: '09121234567',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'خیابان ولیعصر، کوچه نهم، پلاک ۱۲، واحد ۳',
    postalCode: '1234567890',
    paymentMethod: 'card_to_card' as const,
  }

  it('accepts a complete address', () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a too-short address — an incomplete one cannot be delivered', () => {
    expect(checkoutSchema.safeParse({ ...valid, addressLine: 'تهران' }).success).toBe(false)
  })

  it('rejects an unknown payment method', () => {
    expect(checkoutSchema.safeParse({ ...valid, paymentMethod: 'bitcoin' }).success).toBe(false)
  })

  it('rejects a one-character name', () => {
    expect(checkoutSchema.safeParse({ ...valid, fullName: 'م' }).success).toBe(false)
  })
})

describe('paymentReferenceSchema', () => {
  it('accepts an alphanumeric reference in Persian digits', () => {
    const result = paymentReferenceSchema.safeParse({ orderId: 1, referenceCode: '۱۲۳۴۵۶۷۸' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.referenceCode).toBe('12345678')
  })

  it('rejects a reference that is too short to be real', () => {
    expect(paymentReferenceSchema.safeParse({ orderId: 1, referenceCode: '12' }).success).toBe(false)
  })

  it('rejects characters that are not part of a bank reference', () => {
    expect(
      paymentReferenceSchema.safeParse({ orderId: 1, referenceCode: '123<script>' }).success,
    ).toBe(false)
  })
})

describe('reviewSchema', () => {
  it('accepts a rating in range', () => {
    const result = reviewSchema.safeParse({
      productId: 1,
      rating: '۵',
      body: 'کیفیت پارچه عالی بود و سایزش دقیقاً اندازه شد.',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.rating).toBe(5)
  })

  it('rejects a rating outside one to five', () => {
    const base = { productId: 1, body: 'متن دیدگاه به اندازه کافی طولانی است.' }
    expect(reviewSchema.safeParse({ ...base, rating: 0 }).success).toBe(false)
    expect(reviewSchema.safeParse({ ...base, rating: 6 }).success).toBe(false)
  })

  it('rejects a body that is too short to be useful', () => {
    expect(reviewSchema.safeParse({ productId: 1, rating: 5, body: 'خوب' }).success).toBe(false)
  })
})

describe('searchParamsSchema', () => {
  it('applies defaults', () => {
    const result = searchParamsSchema.parse({})
    expect(result.page).toBe(1)
    expect(result.sort).toBe('newest')
  })

  it('rejects an unknown sort rather than silently defaulting', () => {
    expect(searchParamsSchema.safeParse({ sort: 'random' }).success).toBe(false)
  })

  it('caps the page so a crawler cannot request page 99999', () => {
    expect(searchParamsSchema.safeParse({ page: 100_000 }).success).toBe(false)
  })
})

describe('fieldErrors', () => {
  it('keeps only the first message per field', () => {
    const result = checkoutSchema.safeParse({})
    expect(result.success).toBe(false)

    if (!result.success) {
      const errors = fieldErrors(result.error)
      expect(Object.keys(errors).length).toBeGreaterThan(0)
      for (const message of Object.values(errors)) {
        expect(typeof message).toBe('string')
      }
    }
  })
})

describe('formToObject', () => {
  it('converts entries and skips files', () => {
    const form = new FormData()
    form.set('name', 'مریم')
    form.set('city', 'تهران')

    expect(formToObject(form)).toEqual({ name: 'مریم', city: 'تهران' })
  })

  it('collects repeated keys into an array', () => {
    const form = new FormData()
    form.append('tag', 'a')
    form.append('tag', 'b')

    expect(formToObject(form).tag).toEqual(['a', 'b'])
  })
})

describe('navHrefSchema', () => {
  it('accepts internal paths', () => {
    for (const href of ['/', '/blog', '/category/bra', '/products?sort=best', '/p/size-guide']) {
      expect(navHrefSchema.safeParse(href).success).toBe(true)
    }
  })

  it('accepts absolute https urls', () => {
    expect(navHrefSchema.safeParse('https://instagram.com/orchid').success).toBe(true)
  })

  it('rejects script and data urls', () => {
    for (const href of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ]) {
      expect(navHrefSchema.safeParse(href).success).toBe(false)
    }
  })

  it('rejects protocol-relative urls, which escape the site silently', () => {
    expect(navHrefSchema.safeParse('//evil.example').success).toBe(false)
  })

  it('rejects plain http, since the site is https only', () => {
    expect(navHrefSchema.safeParse('http://example.com').success).toBe(false)
  })

  it('rejects empty and whitespace-only values', () => {
    expect(navHrefSchema.safeParse('').success).toBe(false)
    expect(navHrefSchema.safeParse('   ').success).toBe(false)
  })

  it('rejects a bare label with no scheme or leading slash', () => {
    expect(navHrefSchema.safeParse('category/bra').success).toBe(false)
  })
})

describe('navLinkSchema', () => {
  it('requires a label', () => {
    expect(navLinkSchema.safeParse({ label: '', href: '/blog' }).success).toBe(false)
  })

  it('caps the label at sixty characters, matching the column', () => {
    expect(navLinkSchema.safeParse({ label: 'a'.repeat(61), href: '/blog' }).success).toBe(false)
    expect(navLinkSchema.safeParse({ label: 'a'.repeat(60), href: '/blog' }).success).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    const parsed = navLinkSchema.safeParse({ label: '  حراج  ', href: '  /category/sale  ' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.label).toBe('حراج')
      expect(parsed.data.href).toBe('/category/sale')
    }
  })
})
