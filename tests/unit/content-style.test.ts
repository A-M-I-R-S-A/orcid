import { describe, expect, it } from 'vitest'

import { contentStyleClass } from '@/lib/content-style'

describe('contentStyleClass', () => {
  it('returns no classes without an override', () => {
    expect(contentStyleClass(undefined)).toBe('')
    expect(contentStyleClass({ tone: 'plain' })).toBe('')
  })

  it('maps safe presentation settings to fixed classes', () => {
    expect(contentStyleClass({ tone: 'raised', align: 'center' })).toContain('bg-surface-raised')
    expect(contentStyleClass({ tone: 'dark', align: 'end', hidden: true })).toBe(
      'hidden text-left rounded-[var(--radius-card)] bg-ink px-4 py-3 text-bg',
    )
  })
})
