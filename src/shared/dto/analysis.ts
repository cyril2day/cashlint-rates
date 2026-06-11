import type {
  AttributionDto,
  CurrencyCodeDto,
  CurrencySummaryDto,
  ISODateStringDto,
  MaybeDto,
} from './api'
import type { AnalysisMetricKey, FormulaKey, FormulaSummary } from '@/server/domain/formulas/formula-registry'

export type AnalyseDateRangeRequestDto =
  | {
      readonly _tag: 'Preset'
      readonly preset: '7D' | '30D' | '90D' | '1Y'
    }
  | {
      readonly _tag: 'Custom'
      readonly startDate: string
      readonly endDate: string
    }

export type AnalyseRequestDto = {
  readonly base: CurrencyCodeDto
  readonly quote: CurrencyCodeDto
  readonly dateRange: AnalyseDateRangeRequestDto
}

export type AnalysisMetricUnitDto = 'rate' | 'percent' | 'z-score'

export type AnalysisMetricAvailabilityDto =
  | {
      readonly _tag: 'Available'
    }
  | {
      readonly _tag: 'Limited'
      readonly reason: string
    }
  | {
      readonly _tag: 'Unavailable'
      readonly reason: string
    }
  | {
      readonly _tag: 'NotApplicable'
      readonly reason: string
    }

export type AnalysisMetricValueDto = {
  readonly _tag: 'AnalysisMetricValue'
  readonly metricKey: AnalysisMetricKey
  readonly rawValue: MaybeDto<number>
  readonly displayValue: MaybeDto<string>
  readonly unit: MaybeDto<AnalysisMetricUnitDto>
  readonly availability: AnalysisMetricAvailabilityDto
  readonly warnings: ReadonlyArray<string>
}

export type CurrencyPairDto = {
  readonly base: CurrencySummaryDto
  readonly quote: CurrencySummaryDto
  readonly label: string
}

export type AnalysisDateRangeDto = {
  readonly requested: {
    readonly startDate: ISODateStringDto
    readonly endDate: ISODateStringDto
    readonly source: string
  }
  readonly effective: {
    readonly startDate: ISODateStringDto
    readonly endDate: ISODateStringDto
    readonly aligned: boolean
    readonly note: MaybeDto<string>
  }
}

export type PairChartPointDto = {
  readonly date: ISODateStringDto
  readonly rate: number
  readonly displayRate: string
}

export type PairChartViewModelDto = {
  readonly title: string
  readonly summary: string
  readonly points: ReadonlyArray<PairChartPointDto>
  readonly tableCaption: string
}

export type PairAnalysisMetricsDto = {
  readonly latestReferenceRate: AnalysisMetricValueDto
  readonly periodMovement: AnalysisMetricValueDto
  readonly averageRate: AnalysisMetricValueDto
  readonly observedRange: AnalysisMetricValueDto
  readonly latestPosition: AnalysisMetricValueDto
  readonly awayFromTypical: AnalysisMetricValueDto
  readonly typicalMovement: AnalysisMetricValueDto
}

export type DataQualityDto = {
  readonly status: 'same-currency' | 'no-data' | 'limited-data' | 'partial-data' | 'complete'
  readonly requestedObservationCount: number
  readonly usableObservationCount: number
  readonly excludedObservationCount: number
  readonly firstObservationDate: MaybeDto<ISODateStringDto>
  readonly latestObservationDate: MaybeDto<ISODateStringDto>
  readonly messages: ReadonlyArray<string>
}

export type CalculationExplanationDto = {
  readonly formulaKey: FormulaKey
  readonly metricKey: AnalysisMetricKey
  readonly title: string
  readonly plainMeaning: string
  readonly latexFormula: string
  readonly accessibleText: string
  readonly workedSolutionLatex: MaybeDto<string>
  readonly steps: ReadonlyArray<string>
  readonly result: AnalysisMetricValueDto
  readonly interpretation: string
  readonly caveat: MaybeDto<string>
  readonly unavailableReason: MaybeDto<string>
}

export type AIResultContextDto = {
  readonly mode: 'pair-analysis'
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
    readonly observationCount: number
    readonly dataQualityStatus: DataQualityDto['status']
  }>
  readonly chartSummary: MaybeDto<string>
  readonly formulaSummaries: ReadonlyArray<FormulaSummary>
  readonly appDisclaimers: ReadonlyArray<string>
}

export type PairAnalysisViewModelDto = {
  readonly mode: 'pair-analysis'
  readonly pair: CurrencyPairDto
  readonly dateRange: AnalysisDateRangeDto
  readonly chart: PairChartViewModelDto
  readonly metrics: PairAnalysisMetricsDto
  readonly dataQuality: DataQualityDto
  readonly insight: string
  readonly calculationExplanations: ReadonlyArray<CalculationExplanationDto>
  readonly caveats: ReadonlyArray<string>
  readonly attribution: AttributionDto
  readonly aiContextSeed: AIResultContextDto
}
