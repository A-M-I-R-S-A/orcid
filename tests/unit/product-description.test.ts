import { describe, expect, it } from 'vitest'

import { parseProductDescription, serializeProductDescription } from '@/lib/product-description'

describe('structured product descriptions', () => {
  it('keeps legacy plain descriptions as the introduction', () => {
    const parsed = parseProductDescription('توضیح قدیمی محصول')
    expect(parsed.intro).toBe('توضیح قدیمی محصول')
    expect(parsed.features).toHaveLength(4)
  })

  it('round-trips structured fields without HTML rendering', () => {
    const source = parseProductDescription(null)
    source.title = 'عنوان محصول'
    source.features[0] = { title: 'بدون درز', body: 'مناسب استفاده روزانه' }
    const stored = serializeProductDescription(source)
    expect(stored).not.toBeNull()
    expect(parseProductDescription(stored).features[0].title).toBe('بدون درز')
  })

  it('stores an empty editor as null', () => {
    expect(serializeProductDescription(parseProductDescription(null))).toBeNull()
  })
})
