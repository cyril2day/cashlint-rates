import type { AnalysisDateRangeDto, AnalyseDateRangeRequestDto, DataQualityDto } from './analysis'
import type {
  AttributionDto,
  CurrencyCodeDto,
  CurrencySummaryDto,
  ISODateStringDto,
  MaybeDto,
} from './api'

export type CompareRequestDto = {
  readonly base: CurrencyCodeDto
  readonly quotes: ReadonlyArray<CurrencyCodeDto>
  readonly dateRange: AnalyseDateRangeRequestDto
}

export type ComparisonMetricKey =
  | 'latest-reference-rate'
  | 'period-movement'
  | 'relative-variability'

export type ComparisonMetricUnitDto = 'rate' | 'percent'

export type ComparisonMetricAvailabilityDto =
  | {
      readonly _tag: 'Available'
    }
  | {
      readonly _tag: 'Unavailable'
      readonly reason: string
    }
  | {
      readonly _tag: 'NotApplicable'
      readonly reason: string
    }

export type ComparisonMetricValueDto = {
  readonly _tag: 'ComparisonMetricValue'
  readonly metricKey: ComparisonMetricKey
  readonly rawValue: MaybeDto<number>
  readonly displayValue: MaybeDto<string>
  readonly unit: MaybeDto<ComparisonMetricUnitDto>
  readonly availability: ComparisonMetricAvailabilityDto
  readonly warnings: ReadonlyArray<string>
}

export type IndexedComparisonPointDto = {
  readonly date: ISODateStringDto
  readonly quote: CurrencyCodeDto
  readonly indexedValue: number
  readonly displayIndexedValue: string
  readonly actualRate: number
  readonly displayActualRate: string
}

export type IndexedComparisonChartViewModelDto = {
  readonly title: string
  readonly summary: string
  readonly points: ReadonlyArray<IndexedComparisonPointDto>
  readonly tableCaption: string
}

export type ComparisonExclusionReasonDto =
  | 'insufficient-observations'
  | 'same-currency'
  | 'provider-data-unavailable'
  | 'partial-data'

export type ComparisonQuoteInclusionDto =
  | {
      readonly _tag: 'IncludedInRankings'
    }
  | {
      readonly _tag: 'ExcludedFromRankings'
      readonly reason: ComparisonExclusionReasonDto
    }

export type ComparisonQuoteRowDto = {
  readonly quote: CurrencySummaryDto
  readonly latestReferenceRate: ComparisonMetricValueDto
  readonly periodMovement: ComparisonMetricValueDto
  readonly relativeVariability: ComparisonMetricValueDto
  readonly inclusion: ComparisonQuoteInclusionDto
  readonly dataQuality: DataQualityDto
}

export type RankedQuoteDto = {
  readonly quote: CurrencySummaryDto
  readonly metric: ComparisonMetricValueDto
  readonly rank: number
}

export type ComparisonRankingsDto = {
  readonly mostStableQuote: MaybeDto<RankedQuoteDto>
  readonly mostVariableQuote: MaybeDto<RankedQuoteDto>
  readonly periodMovementAscending: ReadonlyArray<RankedQuoteDto>
  readonly periodMovementDescending: ReadonlyArray<RankedQuoteDto>
}

export type QuoteDataQualityDto = {
  readonly quote: CurrencyCodeDto
  readonly dataQuality: DataQualityDto
}

export type ComparisonDataQualityDto = {
  readonly overall: DataQualityDto
  readonly byQuote: ReadonlyArray<QuoteDataQualityDto>
}

export type AIComparisonContextDto = {
  readonly mode: 'comparison'
  readonly selectedCurrencies: {
    readonly base: CurrencyCodeDto
    readonly quotes: ReadonlyArray<CurrencyCodeDto>
  }
  readonly selectedDateRange: MaybeDto<AnalysisDateRangeDto['effective']>
  readonly keyResults: ReadonlyArray<{
    readonly key: string
    readonly label: string
    readonly value: string
  }>
  readonly computedStats: MaybeDto<{
    readonly rankableQuoteCount: number
    readonly dataQualityStatus: DataQualityDto['status']
  }>
  readonly chartSummary: MaybeDto<string>
  readonly formulaSummaries: ReadonlyArray<never>
  readonly appDisclaimers: ReadonlyArray<string>
}

export type ComparisonViewModelDto = {
  readonly mode: 'comparison'
  readonly base: CurrencySummaryDto
  readonly quotes: ReadonlyArray<CurrencySummaryDto>
  readonly dateRange: AnalysisDateRangeDto
  readonly chart: IndexedComparisonChartViewModelDto
  readonly rows: ReadonlyArray<ComparisonQuoteRowDto>
  readonly rankings: ComparisonRankingsDto
  readonly dataQuality: ComparisonDataQualityDto
  readonly insight: string
  readonly calculationExplanations: ReadonlyArray<never>
  readonly caveats: ReadonlyArray<string>
  readonly attribution: AttributionDto
  readonly aiContextSeed: AIComparisonContextDto
}
