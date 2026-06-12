import { describe, expect, it } from 'vitest'
import { convert, toConversionViewModel } from '@/server/application/conversion/convert'
import type { ConversionError, ConversionResult } from '@/server/domain/rates/conversion'
import type { Result } from '@/shared/fp'
import { countingRateProvider, failingRateProvider, successfulRateProvider } from '../../helpers/fake-rate-provider'

const expectSuccess = (result: Result<ConversionError, ConversionResult>): ConversionResult => {
  if (result.tag === 'failure') {
    throw new Error('Expected success result')
  }

  return result.value
}

const expectFailure = (result: Result<ConversionError, ConversionResult>): ConversionError => {
  if (result.tag === 'success') {
    throw new Error('Expected failure result')
  }

  return result.error
}

describe('convert application service', () => {
  it('converts a supported currency pair with provider data', async () => {
    const result = await convert({ exchangeRateProvider: successfulRateProvider() })({
      amount: 1000,
      base: 'USD',
      quote: 'GBP',
    })

    const conversion = expectSuccess(result)

    expect(conversion.convertedAmount).toBe(800)
    expect(conversion.effectiveDate).toBe('2026-06-08')
  })

  it('returns same-currency conversion without calling the provider', async () => {
    const provider = countingRateProvider()
    const result = await convert({ exchangeRateProvider: provider })({
      amount: 250,
      base: 'USD',
      quote: 'USD',
    })

    const conversion = expectSuccess(result)

    expect(conversion.rate).toBe(1)
    expect(conversion.convertedAmount).toBe(250)
    expect(provider.calls()).toBe(0)
  })

  it('maps provider failures to recoverable conversion errors', async () => {
    const result = await convert({
      exchangeRateProvider: failingRateProvider({
        tag: 'network',
        message: 'offline',
      }),
    })({
      amount: 1000,
      base: 'USD',
      quote: 'GBP',
    })

    expect(expectFailure(result).tag).toBe('provider-unavailable')
  })

  it('builds the documented conversion view model', async () => {
    const result = await convert({ exchangeRateProvider: successfulRateProvider() })({
      amount: 1000,
      base: 'USD',
      quote: 'GBP',
    })

    const viewModel = toConversionViewModel(expectSuccess(result))

    expect(viewModel.mode).toBe('conversion')
    expect(viewModel.result.convertedAmount.rawValue).toBe(800)
    expect(viewModel.actions.analysePair.href).toBe('/analyse?base=USD&quote=GBP')
    expect(viewModel.actions.compareBase.href).toBe('/compare?base=USD&quote=GBP')
  })
})
