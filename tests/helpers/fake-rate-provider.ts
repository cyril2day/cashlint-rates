import type { CurrencyCode } from '@/server/domain/currency/currency'
import type { ExchangeRateProvider, LatestRateData, ProviderError } from '@/server/ports/rate-provider'
import { failure, success } from '@/shared/fp'

const code = (value: string): CurrencyCode => value as CurrencyCode

export const fakeLatestRate = (overrides: Partial<LatestRateData> = {}): LatestRateData => ({
  base: code('USD'),
  quote: code('GBP'),
  rate: 0.8,
  effectiveDate: '2026-06-08',
  sourcePair: 'USD/GBP',
  ...overrides,
})

export const successfulRateProvider = (
  data: LatestRateData = fakeLatestRate(),
): ExchangeRateProvider => ({
  getLatestRate: () => Promise.resolve(success(data)),
})

export const failingRateProvider = (error: ProviderError): ExchangeRateProvider => ({
  getLatestRate: () => Promise.resolve(failure(error)),
})

export const countingRateProvider = (
  data: LatestRateData = fakeLatestRate(),
): ExchangeRateProvider & { readonly calls: () => number } => {
  let callCount = 0

  return {
    calls: () => callCount,
    getLatestRate: () => {
      callCount += 1

      return Promise.resolve(success(data))
    },
  }
}
