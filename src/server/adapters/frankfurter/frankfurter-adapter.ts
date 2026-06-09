import type {
  ExchangeRateProvider,
  HistoricalRateData,
  HistoricalRateInput,
  LatestRateData,
  LatestRateInput,
  ProviderError,
} from '@/server/ports/rate-provider'
import { booleanKey, failure, type Result } from '@/shared/fp'
import { decodeFrankfurterLatestRate } from './frankfurter-decode'
import { decodeFrankfurterHistoricalRates } from './frankfurter-historical-decode'
import {
  frankfurterNetworkError,
  frankfurterRateLimitError,
  frankfurterUnavailableError,
} from './frankfurter-errors'

type FrankfurterAdapterDeps = {
  readonly fetchLatest: typeof fetch
  readonly fetchHistorical: typeof fetch
}

const defaultDeps: FrankfurterAdapterDeps = {
  fetchLatest: fetch,
  fetchHistorical: fetch,
}

const endpointFor = (input: LatestRateInput): string => {
  const params = new URLSearchParams({
    from: input.base,
    to: input.quote,
  })

  return `https://api.frankfurter.app/latest?${params.toString()}`
}

const historicalEndpointFor = (input: HistoricalRateInput): string => {
  const params = new URLSearchParams({
    base: input.base,
    from: input.startDate,
    quotes: input.quote,
    to: input.endDate,
  })

  return `https://api.frankfurter.dev/v2/rates?${params.toString()}`
}

const statusError = (status: number): ProviderError =>
  ({
    false: frankfurterUnavailableError(status),
    true: frankfurterRateLimitError,
  })[booleanKey(status === 429)]

const decodeLatestResponse =
  (input: LatestRateInput) =>
  (response: Response): Promise<Result<ProviderError, LatestRateData>> =>
    ({
      false: Promise.resolve(failure(statusError(response.status))),
      true: response
        .json()
        .then((payload: unknown) => decodeFrankfurterLatestRate(input)(payload))
        .catch(() => failure<ProviderError>(frankfurterNetworkError)),
    })[booleanKey(response.ok)]

const decodeHistoricalResponse =
  (input: HistoricalRateInput) =>
  (response: Response): Promise<Result<ProviderError, HistoricalRateData>> =>
    ({
      false: Promise.resolve(failure(statusError(response.status))),
      true: response
        .json()
        .then((payload: unknown) => decodeFrankfurterHistoricalRates(input)(payload))
        .catch(() => failure<ProviderError>(frankfurterNetworkError)),
    })[booleanKey(response.ok)]

export const createFrankfurterExchangeRateProvider = (
  deps: FrankfurterAdapterDeps = defaultDeps,
): ExchangeRateProvider => ({
  getLatestRate: (input) =>
    deps.fetchLatest(endpointFor(input), { cache: 'no-store' })
      .then((response) => decodeLatestResponse(input)(response))
      .catch(() => failure(frankfurterNetworkError)),
  getHistoricalRates: (input) =>
    deps.fetchHistorical(historicalEndpointFor(input), { cache: 'no-store' })
      .then((response) => decodeHistoricalResponse(input)(response))
      .catch(() => failure(frankfurterNetworkError)),
})
