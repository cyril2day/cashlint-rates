import type { CurrencyCode } from '@/server/domain/currency/currency'
import type { ISODateStringDto } from '@/shared/dto/api'
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

export type HistoricalRateInput = {
  readonly base: CurrencyCode
  readonly quote: CurrencyCode
  readonly startDate: ISODateStringDto
  readonly endDate: ISODateStringDto
}

export type HistoricalRateObservation = {
  readonly date: ISODateStringDto
  readonly rate: number | null
}

export type HistoricalRateData = {
  readonly base: CurrencyCode
  readonly quote: CurrencyCode
  readonly startDate: ISODateStringDto
  readonly endDate: ISODateStringDto
  readonly observations: ReadonlyArray<HistoricalRateObservation>
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
export type ProviderHistoricalRateResult = AsyncResult<ProviderError, HistoricalRateData>

export type ExchangeRateProvider = {
  readonly getLatestRate: (input: LatestRateInput) => ProviderLatestRateResult
  readonly getHistoricalRates: (input: HistoricalRateInput) => ProviderHistoricalRateResult
}
