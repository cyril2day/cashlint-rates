import { describe, expect, it } from 'vitest'
import {
  parseCurrencyCode,
  staticSafeCurrencyCatalogue,
} from '@/server/domain/currency/currency'

describe('parseCurrencyCode', () => {
  it('normalises and accepts supported currency codes', () => {
    expect(parseCurrencyCode(staticSafeCurrencyCatalogue)('usd')).toMatchObject({
      tag: 'success',
      value: 'USD',
    })
  })

  it('rejects unsupported currency codes as values', () => {
    expect(parseCurrencyCode(staticSafeCurrencyCatalogue)('XYZ')).toMatchObject({
      tag: 'failure',
      error: {
        code: 'UNSUPPORTED_CURRENCY',
      },
    })
  })
})
