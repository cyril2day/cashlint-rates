import type { CurrencyCode } from '@/server/domain/currency/currency'
import type {
  ExchangeRateProvider,
  HistoricalRateData,
  LatestRateData,
  ProviderCurrencyCatalogueResult,
  ProviderError,
} from '@/server/ports/rate-provider'
import { failure, success } from '@/shared/fp'

const code = (value: CurrencyCode): CurrencyCode => value

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

export const fakeCurrencyCatalogue = (
  overrides: Partial<ProviderCurrencyCatalogueResult> = {},
): ProviderCurrencyCatalogueResult => ({
  source: 'provider',
  retrievedAt: '2026-06-09T00:00:00.000Z',
  currencies: [
    { code: code('EUR'), name: 'Euro' },
    { code: code('GBP'), name: 'British Pound' },
    { code: code('USD'), name: 'US Dollar' },
  ],
  ...overrides,
})

export const successfulRateProvider = (
  data: LatestRateData = fakeLatestRate(),
  historicalData: HistoricalRateData = fakeHistoricalRates(),
  catalogueData: ProviderCurrencyCatalogueResult = fakeCurrencyCatalogue(),
): ExchangeRateProvider => ({
  getCurrencyCatalogue: () => Promise.resolve(success(catalogueData)),
  getLatestRate: () => Promise.resolve(success(data)),
  getHistoricalRates: () => Promise.resolve(success(historicalData)),
})

export const failingRateProvider = (error: ProviderError): ExchangeRateProvider => ({
  getCurrencyCatalogue: () => Promise.resolve(failure(error)),
  getLatestRate: () => Promise.resolve(failure(error)),
  getHistoricalRates: () => Promise.resolve(failure(error)),
})

export const countingRateProvider = (
  data: LatestRateData = fakeLatestRate(),
  historicalData: HistoricalRateData = fakeHistoricalRates(),
  catalogueData: ProviderCurrencyCatalogueResult = fakeCurrencyCatalogue(),
): ExchangeRateProvider & { readonly calls: () => number } => {
  let callCount = 0

  return {
    calls: () => callCount,
    getCurrencyCatalogue: () => {
      callCount += 1

      return Promise.resolve(success(catalogueData))
    },
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
