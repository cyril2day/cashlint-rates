import type {
  AttributionDto,
  AIChartContextDto,
  CurrencyCodeDto,
  CurrencySummaryDto,
  ISODateStringDto,
  MaybeDto,
} from './api'

export type ConvertRequestDto = {
  readonly amount: number
  readonly base: CurrencyCodeDto
  readonly quote: CurrencyCodeDto
}

export type MetricKeyDto = 'converted-amount' | 'latest-reference-rate'

export type MetricUnitDto = 'rate' | 'currency'

export type MetricValueDto = {
  readonly _tag: 'MetricAvailable'
  readonly metricKey: MetricKeyDto
  readonly rawValue: number
  readonly displayValue: string
  readonly unit: MetricUnitDto
  readonly warnings: ReadonlyArray<never>
}

export type RateDerivationDto =
  | {
      readonly _tag: 'DirectRate'
      readonly requestedPair: string
      readonly sourcePair: string
      readonly displayedPair: string
    }
  | {
      readonly _tag: 'SameCurrencyRate'
      readonly requestedPair: string
      readonly sourcePair: string
      readonly displayedPair: string
      readonly formulaKey: 'same-currency-rate'
      readonly displayNote: string
    }

export type MoneyInputDto = {
  readonly rawAmount: number
  readonly displayAmount: string
  readonly currency: CurrencyCodeDto
}

export type ConversionResultDto = {
  readonly convertedAmount: MetricValueDto
  readonly rate: MetricValueDto
  readonly effectiveDate: MaybeDto<ISODateStringDto>
  readonly rateDerivation: RateDerivationDto
}

export type AnalyseActionDto = {
  readonly href: string
  readonly base: CurrencyCodeDto
  readonly quote: CurrencyCodeDto
}

export type CompareActionDto = {
  readonly href: string
  readonly base: CurrencyCodeDto
  readonly quote: CurrencyCodeDto
}

export type ConversionActionsDto = {
  readonly analysePair: AnalyseActionDto
  readonly compareBase: CompareActionDto
}

export type AIResultContextDto = {
  readonly mode: 'conversion'
  readonly selectedCurrencies: {
    readonly base: CurrencyCodeDto
    readonly quotes: ReadonlyArray<CurrencyCodeDto>
  }
  readonly selectedDateRange: MaybeDto<never>
  readonly keyResults: ReadonlyArray<{
    readonly key: string
    readonly label: string
    readonly value: string
  }>
  readonly computedStats: MaybeDto<never>
  readonly chartSummary: MaybeDto<string>
  readonly chartContext: MaybeDto<AIChartContextDto>
  readonly formulaSummaries: ReadonlyArray<never>
  readonly appDisclaimers: ReadonlyArray<string>
}

export type ConversionViewModelDto = {
  readonly mode: 'conversion'
  readonly amount: MoneyInputDto
  readonly base: CurrencySummaryDto
  readonly quote: CurrencySummaryDto
  readonly result: ConversionResultDto
  readonly insight: string
  readonly actions: ConversionActionsDto
  readonly attribution: AttributionDto
  readonly aiContextSeed: AIResultContextDto
}
