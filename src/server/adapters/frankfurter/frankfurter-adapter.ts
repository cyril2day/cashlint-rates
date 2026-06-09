import type {
  ExchangeRateProvider,
  LatestRateData,
  LatestRateInput,
  ProviderError,
} from '@/server/ports/rate-provider'
import { failure, type Result } from '@/shared/fp'
import { decodeFrankfurterLatestRate } from './frankfurter-decode'
import {
  frankfurterNetworkError,
  frankfurterRateLimitError,
  frankfurterUnavailableError,
} from './frankfurter-errors'

type FrankfurterAdapterDeps = {
  readonly fetchLatest: typeof fetch
}

const defaultDeps: FrankfurterAdapterDeps = {
  fetchLatest: fetch,
}

const endpointFor = (input: LatestRateInput): string => {
  const params = new URLSearchParams({
    from: input.base,
    to: input.quote,
  })

  return `https://api.frankfurter.app/latest?${params.toString()}`
}

const statusError = (status: number): ProviderError =>
  ({
    false: frankfurterUnavailableError(status),
    true: frankfurterRateLimitError,
  })[String(status === 429) as 'false' | 'true']

const decodeResponse =
  (input: LatestRateInput) =>
  (response: Response): Promise<Result<ProviderError, LatestRateData>> =>
    ({
      false: Promise.resolve(failure(statusError(response.status))),
      true: response
        .json()
        .then((payload: unknown) => decodeFrankfurterLatestRate(input)(payload))
        .catch(() => failure<ProviderError>(frankfurterNetworkError)),
    })[String(response.ok) as 'false' | 'true']

export const createFrankfurterExchangeRateProvider = (
  deps: FrankfurterAdapterDeps = defaultDeps,
): ExchangeRateProvider => ({
  getLatestRate: (input) =>
    deps.fetchLatest(endpointFor(input), { cache: 'no-store' })
      .then((response) => decodeResponse(input)(response))
      .catch(() => failure(frankfurterNetworkError)),
})
