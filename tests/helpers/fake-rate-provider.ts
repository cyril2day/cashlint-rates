import type { CurrencyCode } from '@/server/domain/currency/currency'
import type {
  ExchangeRateProvider,
  HistoricalRateData,
  LatestRateData,
  ProviderError,
} from '@/server/ports/rate-provider'
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

export const fakeHistoricalRates = (
  overrides: Partial<HistoricalRateData> = {},
): HistoricalRateData => ({
  base: code('USD'),
  quote: code('GBP'),
  startDate: '2026-06-01',
  endDate: '2026-06-08',
  observations: [
    { date: '2026-06-01', rate: 0.79 },
    { date: '2026-06-02', rate: 0.8 },
    { date: '2026-06-08', rate: 0.81 },
  ],
  sourcePair: 'USD/GBP',
  ...overrides,
})

export const successfulRateProvider = (
  data: LatestRateData = fakeLatestRate(),
  historicalData: HistoricalRateData = fakeHistoricalRates(),
): ExchangeRateProvider => ({
  getLatestRate: () => Promise.resolve(success(data)),
  getHistoricalRates: () => Promise.resolve(success(historicalData)),
})

export const failingRateProvider = (error: ProviderError): ExchangeRateProvider => ({
  getLatestRate: () => Promise.resolve(failure(error)),
  getHistoricalRates: () => Promise.resolve(failure(error)),
})

export const countingRateProvider = (
  data: LatestRateData = fakeLatestRate(),
  historicalData: HistoricalRateData = fakeHistoricalRates(),
): ExchangeRateProvider & { readonly calls: () => number } => {
  let callCount = 0

  return {
    calls: () => callCount,
    getLatestRate: () => {
      callCount += 1

      return Promise.resolve(success(data))
    },
    getHistoricalRates: () => {
      callCount += 1

      return Promise.resolve(success(historicalData))
    },
  }
}
