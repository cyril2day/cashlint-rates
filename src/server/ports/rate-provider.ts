import type { CurrencyCode } from '@/server/domain/currency/currency'
import type { AsyncResult } from '@/shared/fp'

export type LatestRateInput = {
  readonly base: CurrencyCode
  readonly quote: CurrencyCode
}

export type LatestRateData = {
  readonly base: CurrencyCode
  readonly quote: CurrencyCode
  readonly rate: number
  readonly effectiveDate: string
  readonly sourcePair: string
}

export type ProviderCurrencyCatalogueResult = {
  readonly source: 'provider'
  readonly retrievedAt: string
  readonly currencies: ReadonlyArray<{
    readonly code: CurrencyCode
    readonly name: string
  }>
}

export type ProviderError =
  | {
      readonly tag: 'network'
      readonly message: string
    }
  | {
      readonly tag: 'unavailable'
      readonly status: number
      readonly message: string
    }
  | {
      readonly tag: 'invalid-payload'
      readonly message: string
    }
  | {
      readonly tag: 'rate-limit'
      readonly message: string
    }

export type ProviderLatestRateResult = AsyncResult<ProviderError, LatestRateData>

export type ExchangeRateProvider = {
  readonly getLatestRate: (input: LatestRateInput) => ProviderLatestRateResult
}
