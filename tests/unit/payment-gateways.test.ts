import { describe, expect, it } from 'vitest'

import {
  safeTorobRedirect,
  toRial,
  verifyBitpayResponse,
} from '@/modules/payments/gateway-client'

describe('payment gateway protocol checks', () => {
  it('converts integer toman amounts to rial', () => {
    expect(toRial(125_000)).toBe(1_250_000)
    expect(() => toRial(-1)).toThrow()
    expect(() => toRial(1.5)).toThrow()
  })

  it('accepts BitPay success only for the exact amount and factor', () => {
    const valid = JSON.stringify({ status: 1, amount: 1_250_000, factorId: '42' })
    const alreadyVerified = JSON.stringify({ status: 11, amount: '1250000', factorId: 42 })

    expect(verifyBitpayResponse(valid, 1_250_000, '42')).toBe(true)
    expect(verifyBitpayResponse(alreadyVerified, 1_250_000, '42')).toBe(true)
    expect(verifyBitpayResponse(valid, 1_250_001, '42')).toBe(false)
    expect(verifyBitpayResponse(valid, 1_250_000, '43')).toBe(false)
    expect(
      verifyBitpayResponse(
        JSON.stringify({ status: -4, amount: 1_250_000, factorId: '42' }),
        1_250_000,
        '42',
      ),
    ).toBe(false)
  })

  it('allows only HTTPS TorobPay redirect hosts', () => {
    expect(safeTorobRedirect('https://cpg.torobpay.com/pay/abc')).toBe(
      'https://cpg.torobpay.com/pay/abc',
    )
    expect(() => safeTorobRedirect('http://cpg.torobpay.com/pay/abc')).toThrow()
    expect(() => safeTorobRedirect('https://torobpay.com.example.test/pay')).toThrow()
    expect(() => safeTorobRedirect('https://user@torobpay.com/pay')).toThrow()
  })
})
