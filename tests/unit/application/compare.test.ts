import { describe, expect, it } from 'vitest'
import { compare, type ComparisonError } from '@/server/application/comparison/compare'
import type { CurrencyCode } from '@/server/domain/currency/currency'
import type { ExchangeRateProvider, HistoricalRateData, HistoricalRateInput } from '@/server/ports/rate-provider'
import type { ComparisonViewModelDto } from '@/shared/dto/comparison'
import { failure, success, type Result } from '@/shared/fp'
import { fakeCurrencyCatalogue, fakeLatestRate } from '../../helpers/fake-rate-provider'

const expectSuccess = (
  result: Result<ComparisonError, ComparisonViewModelDto>,
): ComparisonViewModelDto => {
  if (result.tag === 'failure') {
    throw new Error(`Expected success result, got ${result.error.tag}`)
  }

  return result.value
}

const expectFailure = (
  result: Result<ComparisonError, ComparisonViewModelDto>,
): ComparisonError => {
  if (result.tag === 'success') {
    throw new Error('Expected failure result')
  }

  return result.error
}

const historical = (
  quote: CurrencyCode,
  observations: HistoricalRateData['observations'],
): HistoricalRateData => ({
  base: 'USD',
  quote,
  startDate: '2026-06-01',
  endDate: '2026-06-08',
  observations,
  sourcePair: `USD/${quote}`,
})

const comparisonProvider = (
  dataByQuote: Readonly<Record<string, HistoricalRateData>>,
): ExchangeRateProvider => ({
  getCurrencyCatalogue: () => Promise.resolve(success(fakeCurrencyCatalogue())),
  getLatestRate: () => Promise.resolve(success(fakeLatestRate())),
  getHistoricalRates: (input: HistoricalRateInput) => {
    const data = dataByQuote[input.quote]

    if (data === undefined) {
      return Promise.resolve(failure({ tag: 'network', message: 'offline' }))
    }

    return Promise.resolve(success(data))
  },
})

const compareRequest = {
  base: 'USD',
  dateRange: { _tag: 'Preset', preset: '7D' },
} as const

describe('compare application service', () => {
  it('builds indexed comparison rows and rankings for multiple quotes', async () => {
    const result = await compare({
      exchangeRateProvider: comparisonProvider({
        EUR: historical('EUR', [
          { date: '2026-06-01', rate: 1 },
          { date: '2026-06-02', rate: 1.1 },
          { date: '2026-06-08', rate: 1.2 },
        ]),
        GBP: historical('GBP', [
          { date: '2026-06-01', rate: 0.8 },
          { date: '2026-06-02', rate: 0.81 },
          { date: '2026-06-08', rate: 0.82 },
        ]),
      }),
      today: '2026-06-09',
    })({
      ...compareRequest,
      quotes: ['EUR', 'GBP'],
    })
    const viewModel = expectSuccess(result)

    expect(viewModel.mode).toBe('comparison')
    expect(viewModel.chart.points.find((point) => point.quote === 'EUR')?.indexedValue).toBe(100)
    expect(viewModel.chart.points.find((point) => point.quote === 'GBP')?.indexedValue).toBe(100)
    expect(viewModel.rankings.mostStableQuote).toMatchObject({
      _tag: 'Just',
      value: { quote: { code: 'GBP' } },
    })
  })

  it('keeps provider failures isolated to the affected quote', async () => {
    const result = await compare({
      exchangeRateProvider: comparisonProvider({
        GBP: historical('GBP', [
          { date: '2026-06-01', rate: 0.8 },
          { date: '2026-06-02', rate: 0.81 },
          { date: '2026-06-08', rate: 0.82 },
        ]),
      }),
      today: '2026-06-09',
    })({
      ...compareRequest,
      quotes: ['GBP', 'EUR'],
    })
    const viewModel = expectSuccess(result)

    expect(viewModel.rows.find((row) => row.quote.code === 'EUR')?.inclusion).toEqual({
      _tag: 'ExcludedFromRankings',
      reason: 'provider-data-unavailable',
    })
    expect(viewModel.rankings.mostStableQuote).toMatchObject({
      _tag: 'Just',
      value: { quote: { code: 'GBP' } },
    })
  })

  it('excludes insufficient and partial quote rows from rankings', async () => {
    const result = await compare({
      exchangeRateProvider: comparisonProvider({
        EUR: historical('EUR', [
          { date: '2026-06-01', rate: 1 },
          { date: '2026-06-02', rate: null },
          { date: '2026-06-03', rate: 1.1 },
          { date: '2026-06-08', rate: 1.2 },
        ]),
        GBP: historical('GBP', [{ date: '2026-06-08', rate: 0.82 }]),
      }),
      today: '2026-06-09',
    })({
      ...compareRequest,
      quotes: ['EUR', 'GBP'],
    })
    const viewModel = expectSuccess(result)

    expect(viewModel.rows.find((row) => row.quote.code === 'EUR')?.inclusion).toEqual({
      _tag: 'ExcludedFromRankings',
      reason: 'partial-data',
    })
    expect(viewModel.rows.find((row) => row.quote.code === 'GBP')?.inclusion).toEqual({
      _tag: 'ExcludedFromRankings',
      reason: 'insufficient-observations',
    })
    expect(viewModel.rankings.mostStableQuote).toEqual({ _tag: 'Nothing' })
  })

  it('rejects more than ten quote currencies', async () => {
    const result = await compare({
      exchangeRateProvider: comparisonProvider({}),
      today: '2026-06-09',
    })({
      ...compareRequest,
      quotes: ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'PHP', 'USD', 'EUR', 'GBP'],
    })

    expect(expectFailure(result).tag).toBe('quote-limit-exceeded')
  })

  it('rejects duplicate quote currencies', async () => {
    const result = await compare({
      exchangeRateProvider: comparisonProvider({}),
      today: '2026-06-09',
    })({
      ...compareRequest,
      quotes: ['EUR', 'EUR'],
    })

    expect(expectFailure(result).tag).toBe('duplicate-quote-currency')
  })
})
