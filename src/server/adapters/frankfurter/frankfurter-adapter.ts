import type {
  ExchangeRateProvider,
  HistoricalRateData,
  HistoricalRateInput,
  LatestRateData,
  LatestRateInput,
  ProviderCurrencyCatalogueResult,
  ProviderError,
} from '@/server/ports/rate-provider'
import {
  booleanKey,
  failure,
  matchResult,
  type Result,
} from '@/shared/fp'
import {
  noopTransportLogger,
  type TransportLogEvent,
  type TransportLogger,
  type TransportOperation,
  type TransportStatus,
} from '@/server/ports/transport-logger'
import { decodeFrankfurterCurrencyCatalogue } from './frankfurter-catalogue-decode'
import { decodeFrankfurterLatestRate } from './frankfurter-decode'
import { decodeFrankfurterHistoricalRates } from './frankfurter-historical-decode'
import {
  frankfurterNetworkError,
  frankfurterRateLimitError,
  frankfurterUnavailableError,
} from './frankfurter-errors'

type RequiredFrankfurterAdapterDeps = {
  readonly fetchCatalogue: typeof fetch
  readonly fetchLatest: typeof fetch
  readonly fetchHistorical: typeof fetch
  readonly now: () => string
  readonly logger: TransportLogger
}

type FrankfurterAdapterDeps = Partial<RequiredFrankfurterAdapterDeps>

const defaultDeps: RequiredFrankfurterAdapterDeps = {
  fetchCatalogue: fetch,
  fetchLatest: fetch,
  fetchHistorical: fetch,
  now: () => new Date().toISOString(),
  logger: noopTransportLogger,
}

const catalogueEndpoint = 'https://api.frankfurter.app/currencies'

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

const errorCode = (error: ProviderError): string =>
  ({
    'invalid-payload': 'PROVIDER_PAYLOAD_INVALID',
    network: 'PROVIDER_UNAVAILABLE',
    'rate-limit': 'PROVIDER_RATE_LIMITED',
    unavailable: 'PROVIDER_UNAVAILABLE',
  })[error.tag]

const logStatus = <A>(result: Result<ProviderError, A>): TransportStatus =>
  matchResult<ProviderError, A, TransportStatus>({
    failure: () => 'failure',
    success: () => 'success',
  })(result)

const errorCodeDto = <A>(result: Result<ProviderError, A>): TransportLogEvent['errorCode'] =>
  matchResult<ProviderError, A, TransportLogEvent['errorCode']>({
    failure: (error) => ({ _tag: 'Just', value: errorCode(error) }),
    success: () => ({ _tag: 'Nothing' }),
  })(result)

const logProviderResult =
  (deps: RequiredFrankfurterAdapterDeps, operation: TransportOperation, upstreamStatus: number) =>
  <A>(result: Result<ProviderError, A>): Result<ProviderError, A> => {
    deps.logger.log({
      timestamp: deps.now(),
      route: 'provider',
      operation,
      adapter: 'frankfurter',
      method: 'GET',
      status: logStatus(result),
      durationMs: { _tag: 'Nothing' },
      cachePolicyKey: { _tag: 'Nothing' },
      errorCode: errorCodeDto(result),
      upstreamStatus: { _tag: 'Just', value: upstreamStatus },
      redactionApplied: true,
    })

    return result
  }

const decodeLatestResponse =
  (deps: RequiredFrankfurterAdapterDeps) =>
  (input: LatestRateInput) =>
  (response: Response): Promise<Result<ProviderError, LatestRateData>> =>
    ({
      false: Promise.resolve(failure(statusError(response.status))),
      true: response
        .json()
        .then((payload: unknown) => decodeFrankfurterLatestRate(input)(payload))
        .catch(() => failure<ProviderError>(frankfurterNetworkError)),
    })[booleanKey(response.ok)]
      .then((result) => logProviderResult(deps, 'latest-rate', response.status)<LatestRateData>(result))

const decodeCatalogueResponse =
  (deps: RequiredFrankfurterAdapterDeps) =>
  (retrievedAt: string) =>
  (response: Response): Promise<Result<ProviderError, ProviderCurrencyCatalogueResult>> =>
    ({
      false: Promise.resolve(failure(statusError(response.status))),
      true: response
        .json()
        .then((payload: unknown) => decodeFrankfurterCurrencyCatalogue(retrievedAt)(payload))
        .catch(() => failure<ProviderError>(frankfurterNetworkError)),
    })[booleanKey(response.ok)]
      .then((result) =>
        logProviderResult(deps, 'currency-catalogue', response.status)<ProviderCurrencyCatalogueResult>(result))

const decodeHistoricalResponse =
  (deps: RequiredFrankfurterAdapterDeps) =>
  (input: HistoricalRateInput) =>
  (response: Response): Promise<Result<ProviderError, HistoricalRateData>> =>
    ({
      false: Promise.resolve(failure(statusError(response.status))),
      true: response
        .json()
        .then((payload: unknown) => decodeFrankfurterHistoricalRates(input)(payload))
        .catch(() => failure<ProviderError>(frankfurterNetworkError)),
    })[booleanKey(response.ok)]
      .then((result) => logProviderResult(deps, 'historical-rates', response.status)<HistoricalRateData>(result))

export const createFrankfurterExchangeRateProvider = (
  deps: FrankfurterAdapterDeps = {},
): ExchangeRateProvider => {
  const resolvedDeps: RequiredFrankfurterAdapterDeps = { ...defaultDeps, ...deps }

  return {
    getCurrencyCatalogue: () =>
      resolvedDeps.fetchCatalogue(catalogueEndpoint, { cache: 'no-store' })
        .then((response) => decodeCatalogueResponse(resolvedDeps)(resolvedDeps.now())(response))
      .catch(() => failure(frankfurterNetworkError)),
    getLatestRate: (input) =>
      resolvedDeps.fetchLatest(endpointFor(input), { cache: 'no-store' })
        .then((response) => decodeLatestResponse(resolvedDeps)(input)(response))
        .catch(() => failure(frankfurterNetworkError)),
    getHistoricalRates: (input) =>
      resolvedDeps.fetchHistorical(historicalEndpointFor(input), { cache: 'no-store' })
        .then((response) => decodeHistoricalResponse(resolvedDeps)(input)(response))
        .catch(() => failure(frankfurterNetworkError)),
  }
}
