import { describe, expect, it } from 'vitest'
import { decodeFrankfurterHistoricalRates } from '@/server/adapters/frankfurter/frankfurter-historical-decode'
import { createFrankfurterExchangeRateProvider } from '@/server/adapters/frankfurter/frankfurter-adapter'
import type { CurrencyCode } from '@/server/domain/currency/currency'
import type {
  HistoricalRateData,
  HistoricalRateInput,
  ProviderError,
} from '@/server/ports/rate-provider'
import type { Result } from '@/shared/fp'

const code = (value: string): CurrencyCode => value as CurrencyCode

const historicalInput: HistoricalRateInput = {
  base: code('USD'),
  quote: code('GBP'),
  startDate: '2026-06-01',
  endDate: '2026-06-08',
}

const expectSuccess = (result: Result<ProviderError, HistoricalRateData>): HistoricalRateData => {
  if (result.tag === 'failure') {
    throw new Error(`Expected success result, got ${JSON.stringify(result.error)}`)
  }

  return result.value
}

const expectFailure = (result: Result<ProviderError, HistoricalRateData>): ProviderError => {
  if (result.tag === 'success') {
    throw new Error(`Expected failure result, got ${JSON.stringify(result.value)}`)
  }

  return result.error
}

const fetchInputUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

describe('Frankfurter historical-rate adapter', () => {
  it('decodes v2 time-series rows without filling missing provider dates', () => {
    const result = decodeFrankfurterHistoricalRates(historicalInput)([
      { date: '2026-06-01', base: 'USD', quote: 'GBP', rate: 0.79 },
      { date: '2026-06-03', base: 'USD', quote: 'GBP', rate: null },
      { date: '2026-06-08', base: 'USD', quote: 'GBP', rate: 0.81 },
    ])
    const data = expectSuccess(result)

    expect(data).toEqual({
      base: code('USD'),
      quote: code('GBP'),
      startDate: '2026-06-01',
      endDate: '2026-06-08',
      observations: [
        { date: '2026-06-01', rate: 0.79 },
        { date: '2026-06-03', rate: null },
        { date: '2026-06-08', rate: 0.81 },
      ],
      sourcePair: 'USD/GBP',
    })
  })

  it('rejects rows for a different requested pair as invalid provider payloads', () => {
    const error = expectFailure(
      decodeFrankfurterHistoricalRates(historicalInput)([
        { date: '2026-06-01', base: 'EUR', quote: 'GBP', rate: 0.79 },
      ]),
    )

    expect(error.tag).toBe('invalid-payload')
  })

  it('calls the current Frankfurter v2 range endpoint for historical data', async () => {
    let requestedUrl = ''
    const fetchLatest: typeof fetch = () =>
      Promise.resolve(Response.json({ base: 'USD', date: '2026-06-08', rates: { GBP: 0.8 } }))
    const fetchHistorical: typeof fetch = (input) => {
      requestedUrl = fetchInputUrl(input)

      return Promise.resolve(
        Response.json([
          { date: '2026-06-01', base: 'USD', quote: 'GBP', rate: 0.79 },
        ]),
      )
    }

    const result = await createFrankfurterExchangeRateProvider({
      fetchHistorical,
      fetchLatest,
    }).getHistoricalRates(historicalInput)

    expect(expectSuccess(result).observations).toEqual([
      { date: '2026-06-01', rate: 0.79 },
    ])
    expect(requestedUrl).toBe(
      'https://api.frankfurter.dev/v2/rates?base=USD&from=2026-06-01&quotes=GBP&to=2026-06-08',
    )
  })

  it('maps historical non-2xx responses and rate limits to typed provider failures', async () => {
    const fetchLatest: typeof fetch = () =>
      Promise.resolve(Response.json({ base: 'USD', date: '2026-06-08', rates: { GBP: 0.8 } }))
    const fetchHistorical: typeof fetch = () => Promise.resolve(new Response(null, { status: 429 }))
    const result = await createFrankfurterExchangeRateProvider({
      fetchHistorical,
      fetchLatest,
    }).getHistoricalRates(historicalInput)

    expect(expectFailure(result).tag).toBe('rate-limit')
  })
})
