import {
  parseCurrencyCode,
  staticSafeCurrencyCatalogue,
  type CurrencyCode,
  type SupportedCurrency,
} from '@/server/domain/currency/currency'
import {
  customDateRange,
  friendlyPreviousToleranceDays,
  parseDateRangePreset,
  presetDateRange,
  resolveDateRange,
  type DateRangeError,
  type DateRangeRequest,
  type ResolvedDateRange,
} from '@/server/domain/date-range/date-range'
import {
  analysisFormulaEntries,
  formulaSummariesForMetrics,
  type AnalysisMetricKey,
  type FormulaRegistryEntry,
} from '@/server/domain/formulas/formula-registry'
import { isSameCurrencyPair, type CurrencyPair } from '@/server/domain/rates/conversion'
import {
  deriveRateSeries,
  type ApplicableRateSeries,
  type DerivedRateSeries,
  type RateDerivationError,
  type RateObservation,
} from '@/server/domain/rates/rate-derivation'
import {
  calculateRateLevelStats,
  zScoreUnavailableReason,
  type RateLevelStats,
} from '@/server/domain/statistics/descriptive-statistics'
import {
  calculateMovementStats,
  type MovementStats,
} from '@/server/domain/statistics/movement-statistics'
import type { ExchangeRateProvider, HistoricalRateData, ProviderError } from '@/server/ports/rate-provider'
import { addCalendarDays, isIsoDateBefore } from '@/shared/date'
import type {
  AnalysisDateRangeDto,
  AnalysisMetricAvailabilityDto,
  AnalysisMetricUnitDto,
  AnalysisMetricValueDto,
  AnalyseDateRangeRequestDto,
  AnalyseRequestDto,
  CalculationExplanationDto,
  DataQualityDto,
  PairAnalysisMetricsDto,
  PairAnalysisViewModelDto,
  PairChartPointDto,
} from '@/shared/dto/analysis'
import type { ISODateStringDto, MaybeDto } from '@/shared/dto/api'
import {
  booleanKey,
  chainResult,
  failure,
  foldMaybe,
  fromNullable,
  liftResult2,
  mapFailure,
  mapMaybe,
  mapResult,
  matchBoolean,
  matchDtoTag,
  matchMaybe,
  matchResult,
  matchTag,
  none,
  some,
  success,
  type AsyncResult,
  type Maybe,
  type Result,
  withDefault,
} from '@/shared/fp'

type AnalysisDeps = {
  readonly exchangeRateProvider: ExchangeRateProvider
  readonly today: ISODateStringDto
}

type ValidatedAnalysisInput = {
  readonly pair: CurrencyPair
  readonly requestedDateRange: ResolvedDateRange
  readonly effectiveDateRange: ResolvedDateRange
}

export type AnalysisError =
  | {
      readonly tag: 'invalid-json'
      readonly message: string
    }
  | {
      readonly tag: 'invalid-request-shape'
      readonly field: string
      readonly message: string
    }
  | {
      readonly tag: 'unsupported-currency'
      readonly field: 'base' | 'quote'
      readonly candidate: string
      readonly message: string
    }
  | {
      readonly tag: 'date-range-error'
      readonly error: DateRangeError
    }
  | {
      readonly tag: 'provider-unavailable'
      readonly message: string
    }
  | {
      readonly tag: 'provider-payload-invalid'
      readonly message: string
    }
  | {
      readonly tag: 'rate-derivation-unavailable'
      readonly message: string
    }

const attribution = {
  label: 'Exchange-rate data powered by Frankfurter.',
  sourceName: 'Frankfurter',
  sourceUrl: 'https://www.frankfurter.app/',
}

const notEnoughData = 'Not enough usable historical observations for this metric.'
const sameCurrencyReason =
  'Same-currency conversion is always 1:1, so historical movement statistics are not applicable.'

const findCurrency = (
  code: CurrencyCode,
): Maybe<SupportedCurrency> =>
  fromNullable(
    staticSafeCurrencyCatalogue.currencies.find((currency) => currency.code === code),
  )

const currencyName = (code: CurrencyCode): string =>
  foldMaybe<SupportedCurrency, string>(code, (c) => c.name)(findCurrency(code))

const toCurrencySummary = (code: CurrencyCode): SupportedCurrency => ({
  code,
  name: currencyName(code),
  symbol: foldMaybe<SupportedCurrency, string>(code, (c) => c.symbol)(findCurrency(code)),
})

const unsupportedCurrency = (field: 'base' | 'quote', candidate: string): AnalysisError => ({
  tag: 'unsupported-currency',
  field,
  candidate,
  message: `${candidate.toUpperCase()} is not in the supported currency catalogue.`,
})

const parseInputCurrency = (
  field: 'base' | 'quote',
  candidate: string,
): Result<AnalysisError, CurrencyCode> =>
  mapFailure(() => unsupportedCurrency(field, candidate))(
    parseCurrencyCode(staticSafeCurrencyCatalogue)(candidate),
  )

const dateRangeErrorToAnalysisError = (error: DateRangeError): AnalysisError => ({
  tag: 'date-range-error',
  error,
})

const customDateRangeRequest = (
  range: Extract<AnalyseDateRangeRequestDto, { readonly _tag: 'Custom' }>,
): Result<AnalysisError, DateRangeRequest> =>
  success(customDateRange(range.startDate, range.endDate))

const presetDateRangeRequest = (
  range: Extract<AnalyseDateRangeRequestDto, { readonly _tag: 'Preset' }>,
): Result<AnalysisError, DateRangeRequest> => {
  const parsedPreset = mapFailure(dateRangeErrorToAnalysisError)(parseDateRangePreset(range.preset))

  return mapResult(presetDateRange)(parsedPreset)
}

const dtoDateRangeRequest = (
  input: AnalyseDateRangeRequestDto,
): Result<AnalysisError, DateRangeRequest> =>
  matchDtoTag<AnalyseDateRangeRequestDto, Result<AnalysisError, DateRangeRequest>>({
    Custom: customDateRangeRequest,
    Preset: presetDateRangeRequest,
  })(input)

const providerErrorToAnalysisError = (error: ProviderError): AnalysisError =>
  ((category: Readonly<Record<ProviderError['tag'], AnalysisError>>) => category)({
    'invalid-payload': {
      tag: 'provider-payload-invalid',
      message: 'The historical reference-rate payload could not be validated.',
    },
    network: {
      tag: 'provider-unavailable',
      message: 'We could not load historical reference rates just now. Please try again.',
    },
    'rate-limit': {
      tag: 'provider-unavailable',
      message: 'The reference-rate provider is busy right now. Please try again.',
    },
    unavailable: {
      tag: 'provider-unavailable',
      message: 'We could not load historical reference rates just now. Please try again.',
    },
  })[error.tag]

const alignDateRange = (range: ResolvedDateRange, today: ISODateStringDto): ResolvedDateRange => {
  const friendlyEndDate = addCalendarDays(today, -1)
  const alignedEndDate = matchBoolean<ISODateStringDto>({
    false: () => friendlyEndDate,
    true: () => range.endDate,
  })(isIsoDateBefore(range.endDate, today))

  return {
    startDate: range.startDate,
    endDate: alignedEndDate,
    source: range.source,
  }
}

const validatedInput = (
  base: CurrencyCode,
  quote: CurrencyCode,
  requestedDateRange: ResolvedDateRange,
  effectiveDateRange: ResolvedDateRange,
): ValidatedAnalysisInput => ({
  pair: { base, quote },
  requestedDateRange,
  effectiveDateRange,
})

const resolveAnalysisDateRange =
  (deps: AnalysisDeps) =>
  (dateRangeRequest: DateRangeRequest): Result<AnalysisError, ResolvedDateRange> =>
    mapFailure(dateRangeErrorToAnalysisError)(resolveDateRange(dateRangeRequest, deps.today))

const validatedInputFromResolvedRange =
  (deps: AnalysisDeps, input: AnalyseRequestDto) =>
  (range: ResolvedDateRange): Result<AnalysisError, ValidatedAnalysisInput> =>
    liftResult2((base: CurrencyCode, quote: CurrencyCode) =>
      validatedInput(base, quote, range, alignDateRange(range, deps.today)))(
      parseInputCurrency('base', input.base),
      parseInputCurrency('quote', input.quote),
    )

const validateInput = (deps: AnalysisDeps, input: AnalyseRequestDto): Result<AnalysisError, ValidatedAnalysisInput> => {
  const dateRangeRequest = dtoDateRangeRequest(input.dateRange)
  const resolvedRange = chainResult<AnalysisError, DateRangeRequest, ResolvedDateRange>(
    resolveAnalysisDateRange(deps),
  )(dateRangeRequest)

  return chainResult<AnalysisError, ResolvedDateRange, ValidatedAnalysisInput>(
    validatedInputFromResolvedRange(deps, input),
  )(resolvedRange)
}

const rateDerivationErrorToAnalysisError = (error: RateDerivationError): AnalysisError => ({
  tag: 'rate-derivation-unavailable',
  message: error.message,
})

const historicalRateInput = (input: ValidatedAnalysisInput) => ({
  base: input.pair.base,
  quote: input.pair.quote,
  startDate: input.effectiveDateRange.startDate,
  endDate: input.effectiveDateRange.endDate,
})

const deriveHistoricalRateSeries =
  (pair: CurrencyPair) =>
  (historicalRates: HistoricalRateData): Result<AnalysisError, DerivedRateSeries> =>
    mapFailure(rateDerivationErrorToAnalysisError)(
      deriveRateSeries({
        requestedPair: pair,
        historicalRates,
      }),
    )

const providerHistoricalRates = (
  deps: AnalysisDeps,
  input: ValidatedAnalysisInput,
): AsyncResult<AnalysisError, HistoricalRateData> =>
  deps.exchangeRateProvider
    .getHistoricalRates(historicalRateInput(input))
    .then(mapFailure(providerErrorToAnalysisError))

const fetchHistoricalRateSeries =
  (deps: AnalysisDeps, input: ValidatedAnalysisInput): AsyncResult<AnalysisError, DerivedRateSeries> =>
    providerHistoricalRates(deps, input)
      .then(chainResult<AnalysisError, HistoricalRateData, DerivedRateSeries>(
        deriveHistoricalRateSeries(input.pair),
      ))

const sameCurrencySeries = (pair: CurrencyPair): DerivedRateSeries => ({
  tag: 'not-applicable',
  reason: 'same-currency',
  base: pair.base,
  quote: pair.quote,
  observations: [],
  excludedObservations: [],
  excludedObservationCount: 0,
  message: sameCurrencyReason,
})

const resolveRateSeries =
  (deps: AnalysisDeps, input: ValidatedAnalysisInput): AsyncResult<AnalysisError, DerivedRateSeries> =>
    matchBoolean<AsyncResult<AnalysisError, DerivedRateSeries>>({
      false: () => fetchHistoricalRateSeries(deps, input),
      true: () => Promise.resolve(success(sameCurrencySeries(input.pair))),
    })(isSameCurrencyPair(input.pair))

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
  minimumFractionDigits: 0,
})

const percentFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const latexNumberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
  minimumFractionDigits: 0,
  useGrouping: false,
})

const latexPercentFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  useGrouping: false,
})

const maybeDto = <A>(maybe: Maybe<A>): MaybeDto<A> =>
  matchMaybe<A, MaybeDto<A>>({
    none: () => ({ _tag: 'Nothing' }),
    some: (value) => ({ _tag: 'Just', value }),
  })(maybe)

const maybeFromDto = <A>(maybe: MaybeDto<A>): Maybe<A> =>
  matchDtoTag<MaybeDto<A>, Maybe<A>>({
    Just: (just) => fromNullable(just.value),
    Nothing: () => none<A>(),
  })(maybe)

const justDto = <A>(value: A): MaybeDto<A> => ({ _tag: 'Just', value })

const nothingDto = <A>(): MaybeDto<A> => ({ _tag: 'Nothing' })

const displayRate = (value: number): string => numberFormat.format(value)

const displayPercent = (value: number): string => `${percentFormat.format(value)}%`

const displayZScore = (value: number): string => percentFormat.format(value)

const latexNumber = (value: number): string => latexNumberFormat.format(value)

const latexPercent = (value: number): string => `${latexPercentFormat.format(value)}\\%`

const displayValue =
  (unit: AnalysisMetricUnitDto) =>
  (value: number): string =>
    ({
      percent: () => displayPercent(value),
      rate: () => displayRate(value),
      'z-score': () => displayZScore(value),
    })[unit]()

const availableMetric = (
  metricKey: AnalysisMetricKey,
  value: number,
  unit: AnalysisMetricUnitDto,
): AnalysisMetricValueDto => ({
  _tag: 'AnalysisMetricValue',
  metricKey,
  rawValue: justDto(value),
  displayValue: justDto(displayValue(unit)(value)),
  unit: justDto(unit),
  availability: { _tag: 'Available' },
  warnings: [],
})

const unavailableMetric = (
  metricKey: AnalysisMetricKey,
  reason: string,
): AnalysisMetricValueDto => ({
  _tag: 'AnalysisMetricValue',
  metricKey,
  rawValue: nothingDto(),
  displayValue: nothingDto(),
  unit: nothingDto(),
  availability: { _tag: 'Unavailable', reason },
  warnings: [],
})

const notApplicableMetric = (metricKey: AnalysisMetricKey): AnalysisMetricValueDto => ({
  _tag: 'AnalysisMetricValue',
  metricKey,
  rawValue: nothingDto(),
  displayValue: nothingDto(),
  unit: nothingDto(),
  availability: { _tag: 'NotApplicable', reason: sameCurrencyReason },
  warnings: [],
})

const metricFromMaybe = (
  metricKey: AnalysisMetricKey,
  unit: AnalysisMetricUnitDto,
  maybe: Maybe<number>,
  unavailableReason: string,
): AnalysisMetricValueDto =>
  matchMaybe<number, AnalysisMetricValueDto>({
    none: () => unavailableMetric(metricKey, unavailableReason),
    some: (value) => availableMetric(metricKey, value, unit),
  })(maybe)

const metricsFromStats = (
  levelStats: RateLevelStats,
  movementStats: MovementStats,
): PairAnalysisMetricsDto => ({
  latestReferenceRate: metricFromMaybe('latest-reference-rate', 'rate', levelStats.latestRate, notEnoughData),
  periodMovement: metricFromMaybe('period-movement', 'percent', movementStats.periodMovementPercent, notEnoughData),
  averageRate: metricFromMaybe('average-rate', 'rate', levelStats.mean, notEnoughData),
  observedRange: metricFromMaybe('observed-range', 'rate', levelStats.range, notEnoughData),
  latestPosition: metricFromMaybe('latest-position', 'percent', levelStats.percentilePosition, notEnoughData),
  awayFromTypical: metricFromMaybe('away-from-typical', 'z-score', levelStats.zScore, zScoreUnavailableReason),
  typicalMovement: metricFromMaybe('typical-movement', 'percent', movementStats.typicalMovementPercent, notEnoughData),
})

const sameCurrencyMetrics = (): PairAnalysisMetricsDto => ({
  latestReferenceRate: availableMetric('latest-reference-rate', 1, 'rate'),
  periodMovement: notApplicableMetric('period-movement'),
  averageRate: notApplicableMetric('average-rate'),
  observedRange: notApplicableMetric('observed-range'),
  latestPosition: notApplicableMetric('latest-position'),
  awayFromTypical: notApplicableMetric('away-from-typical'),
  typicalMovement: notApplicableMetric('typical-movement'),
})

const metricByKey = (metrics: PairAnalysisMetricsDto, key: AnalysisMetricKey): AnalysisMetricValueDto =>
  ({
    'average-rate': () => metrics.averageRate,
    'away-from-typical': () => metrics.awayFromTypical,
    'latest-position': () => metrics.latestPosition,
    'latest-reference-rate': () => metrics.latestReferenceRate,
    'observed-range': () => metrics.observedRange,
    'period-movement': () => metrics.periodMovement,
    'typical-movement': () => metrics.typicalMovement,
  })[key]()

type WorkedSolutionContext = {
  readonly levelStats: RateLevelStats
  readonly movementStats: MovementStats
  readonly metrics: PairAnalysisMetricsDto
}

type WorkedSolutionBuilder = (context: WorkedSolutionContext) => Maybe<string>

const appendMaybeNumber = (
  state: Maybe<ReadonlyArray<number>>,
  value: Maybe<number>,
): Maybe<ReadonlyArray<number>> =>
  matchMaybe<ReadonlyArray<number>, Maybe<ReadonlyArray<number>>>({
    none: () => none<ReadonlyArray<number>>(),
    some: (values) =>
      matchMaybe<number, Maybe<ReadonlyArray<number>>>({
        none: () => none<ReadonlyArray<number>>(),
        some: (numberValue) => some([...values, numberValue]),
      })(value),
  })(state)

const sequenceNumbers = (
  values: ReadonlyArray<Maybe<number>>,
): Maybe<ReadonlyArray<number>> =>
  values.reduce(appendMaybeNumber, some<ReadonlyArray<number>>([]))

const workedFromNumbers =
  (values: ReadonlyArray<Maybe<number>>) =>
  (project: (numbers: ReadonlyArray<number>) => string): Maybe<string> =>
    mapMaybe(project)(sequenceNumbers(values))

const numberAt =
  (index: number) =>
  (values: ReadonlyArray<number>): number =>
    withDefault(0)(fromNullable(values[index]))

const rateCount = (context: WorkedSolutionContext): number =>
  context.levelStats.observationCount

const returnCount = (context: WorkedSolutionContext): number =>
  context.movementStats.returnObservationCount

const latestReferenceRateSolution: WorkedSolutionBuilder = (context) =>
  workedFromNumbers([context.levelStats.latestRate])((numbers) => {
    const latest = numberAt(0)(numbers)

    return String.raw`r_{\mathrm{latest}} = r_n = ${latexNumber(latest)}`
  })

const periodMovementSolution: WorkedSolutionBuilder = (context) =>
  workedFromNumbers([
    context.levelStats.firstRate,
    context.levelStats.latestRate,
    maybeFromDto(context.metrics.periodMovement.rawValue),
  ])((numbers) => {
    const first = numberAt(0)(numbers)
    const latest = numberAt(1)(numbers)
    const result = numberAt(2)(numbers)

    return String.raw`\frac{${latexNumber(latest)} - ${latexNumber(first)}}{${latexNumber(first)}} \times 100 = ${latexPercent(result)}`
  })

const averageRateSolution: WorkedSolutionBuilder = (context) =>
  workedFromNumbers([
    context.levelStats.mean,
    maybeFromDto(context.metrics.averageRate.rawValue),
  ])((numbers) => {
    const mean = numberAt(0)(numbers)
    const result = numberAt(1)(numbers)

    return String.raw`\bar{r} = \frac{\sum r_i}{${rateCount(context).toString()}} = \frac{${latexNumber(mean * rateCount(context))}}{${rateCount(context).toString()}} = ${latexNumber(result)}`
  })

const observedRangeSolution: WorkedSolutionBuilder = (context) =>
  workedFromNumbers([
    context.levelStats.min,
    context.levelStats.max,
    maybeFromDto(context.metrics.observedRange.rawValue),
  ])((numbers) => {
    const minimum = numberAt(0)(numbers)
    const maximum = numberAt(1)(numbers)
    const result = numberAt(2)(numbers)

    return String.raw`\max(r) - \min(r) = ${latexNumber(maximum)} - ${latexNumber(minimum)} = ${latexNumber(result)}`
  })

const latestPositionSolution: WorkedSolutionBuilder = (context) =>
  workedFromNumbers([
    context.levelStats.latestRate,
    maybeFromDto(context.metrics.latestPosition.rawValue),
  ])((numbers) => {
    const latest = numberAt(0)(numbers)
    const result = numberAt(1)(numbers)

    return String.raw`\frac{\#\{r_i \le ${latexNumber(latest)}\}}{${rateCount(context).toString()}} \times 100 = ${latexPercent(result)}`
  })

const awayFromTypicalSolution: WorkedSolutionBuilder = (context) =>
  workedFromNumbers([
    context.levelStats.latestRate,
    context.levelStats.mean,
    context.levelStats.populationStdDev,
    maybeFromDto(context.metrics.awayFromTypical.rawValue),
  ])((numbers) => {
    const latest = numberAt(0)(numbers)
    const mean = numberAt(1)(numbers)
    const standardDeviation = numberAt(2)(numbers)
    const result = numberAt(3)(numbers)

    return String.raw`z = \frac{${latexNumber(latest)} - ${latexNumber(mean)}}{${latexNumber(standardDeviation)}} = ${latexNumber(result)}`
  })

const typicalMovementSolution: WorkedSolutionBuilder = (context) =>
  workedFromNumbers([
    context.movementStats.meanLogReturn,
    context.movementStats.sampleStdDevLogReturn,
    maybeFromDto(context.metrics.typicalMovement.rawValue),
  ])((numbers) => {
    const meanLogReturn = numberAt(0)(numbers)
    const sampleStdDevLogReturn = numberAt(1)(numbers)
    const result = numberAt(2)(numbers)

    return String.raw`s_{\ell} = \sqrt{\frac{\sum_{i=1}^{${returnCount(context).toString()}}(\ell_i - ${latexNumber(meanLogReturn)})^2}{${returnCount(context).toString()} - 1}} \times 100 = ${latexNumber(sampleStdDevLogReturn)} \times 100 = ${latexPercent(result)}`
  })

const workedSolutionBuilders: Readonly<Record<AnalysisMetricKey, WorkedSolutionBuilder>> = {
  'average-rate': averageRateSolution,
  'away-from-typical': awayFromTypicalSolution,
  'latest-position': latestPositionSolution,
  'latest-reference-rate': latestReferenceRateSolution,
  'observed-range': observedRangeSolution,
  'period-movement': periodMovementSolution,
  'typical-movement': typicalMovementSolution,
}

const workedSolutionLatex =
  (context: WorkedSolutionContext) =>
  (metricKey: AnalysisMetricKey): MaybeDto<string> =>
    maybeDto(workedSolutionBuilders[metricKey](context))

const emptyLevelStats = (): RateLevelStats => ({
  observationCount: 0,
  firstRate: none(),
  latestRate: none(),
  min: none(),
  max: none(),
  range: none(),
  mean: none(),
  median: none(),
  populationStdDev: none(),
  percentilePosition: none(),
  zScore: none(),
  unusualnessLabel: 'not_applicable',
})

const emptyMovementStats = (): MovementStats => ({
  returnObservationCount: 0,
  periodMovementPercent: none(),
  meanLogReturn: none(),
  sampleStdDevLogReturn: none(),
  typicalMovementPercent: none(),
  displayStrength: 'unavailable',
  logReturns: [],
})

const emptyWorkedSolutionContext = (
  metrics: PairAnalysisMetricsDto,
): WorkedSolutionContext => ({
  levelStats: emptyLevelStats(),
  movementStats: emptyMovementStats(),
  metrics,
})

const unavailableReason = (metric: AnalysisMetricValueDto): MaybeDto<string> =>
  matchDtoTag<AnalysisMetricAvailabilityDto, MaybeDto<string>>({
    Available: () => nothingDto<string>(),
    Limited: (limited) => justDto(limited.reason),
    NotApplicable: (notApplicable) => justDto(notApplicable.reason),
    Unavailable: (unavailable) => justDto(unavailable.reason),
  })(metric.availability)

const completeOrPartialStatusByKey: Readonly<Record<'false' | 'true', DataQualityDto['status']>> = {
  false: 'complete',
  true: 'partial-data',
}

const noDataOrLimitedStatusByKey: Readonly<Record<'false' | 'true', DataQualityDto['status']>> = {
  false: 'limited-data',
  true: 'no-data',
}

const explanation =
  (context: WorkedSolutionContext) =>
  (entry: FormulaRegistryEntry): CalculationExplanationDto => ({
    formulaKey: entry.formulaKey,
    metricKey: entry.metricKey,
    title: entry.title,
    plainMeaning: entry.plainMeaning,
    latexFormula: entry.latex,
    accessibleText: entry.accessibleFormulaText,
    workedSolutionLatex: workedSolutionLatex(context)(entry.metricKey),
    steps: entry.steps,
    result: metricByKey(context.metrics, entry.metricKey),
    interpretation: entry.interpretation,
    caveat: justDto(entry.caveat),
    unavailableReason: unavailableReason(metricByKey(context.metrics, entry.metricKey)),
  })

const chartPoint = (observation: RateObservation): PairChartPointDto => ({
  date: observation.date,
  rate: observation.rate,
  displayRate: displayRate(observation.rate),
})

const chartSummary = (pair: CurrencyPair, count: number): string =>
  ({
    false: () => `No usable historical observations were found for ${pair.base}/${pair.quote}.`,
    true: () => `${pair.base}/${pair.quote} has ${count.toString()} usable historical observations in the selected period.`,
  })[booleanKey(count > 0)]()

const firstObservationDate = (observations: ReadonlyArray<RateObservation>): Maybe<ISODateStringDto> =>
  mapMaybe((observation: RateObservation) => observation.date)(fromNullable(observations[0]))

const latestObservationDate = (observations: ReadonlyArray<RateObservation>): Maybe<ISODateStringDto> =>
  mapMaybe((observation: RateObservation) => observation.date)(
    fromNullable(observations[observations.length - 1]),
  )

const completeOrPartialStatus = (
  excludedObservationCount: number,
): DataQualityDto['status'] =>
  completeOrPartialStatusByKey[booleanKey(excludedObservationCount > 0)]

const noDataOrLimitedStatus = (
  usableObservationCount: number,
): DataQualityDto['status'] =>
  noDataOrLimitedStatusByKey[booleanKey(usableObservationCount === 0)]

const dataQualityStatus = (
  requestedObservationCount: number,
  usableObservationCount: number,
  excludedObservationCount: number,
): DataQualityDto['status'] =>
  ({
    false: () => completeOrPartialStatus(excludedObservationCount),
    true: () => noDataOrLimitedStatus(usableObservationCount),
  })[booleanKey(usableObservationCount < 2)]()

const dataQualityMessage = (status: DataQualityDto['status']): string =>
  ({
    complete: () => 'All returned observations were usable.',
    'limited-data': () => 'Only limited historical data was available for the selected period.',
    'no-data': () => 'No usable historical observations were returned for the selected period.',
    'partial-data': () => 'Some provider observations were excluded because they were missing or invalid.',
    'same-currency': () => sameCurrencyReason,
  })[status]()

const seriesDataQuality = (
  requestedObservationCount: number,
  series: ApplicableRateSeries,
): DataQualityDto => {
  const status = dataQualityStatus(
    requestedObservationCount,
    series.observations.length,
    series.excludedObservationCount,
  )

  return {
    status,
    requestedObservationCount,
    usableObservationCount: series.observations.length,
    excludedObservationCount: series.excludedObservationCount,
    firstObservationDate: maybeDto(firstObservationDate(series.observations)),
    latestObservationDate: maybeDto(latestObservationDate(series.observations)),
    messages: [dataQualityMessage(status)],
  }
}

const sameCurrencyDataQuality = (): DataQualityDto => ({
  status: 'same-currency',
  requestedObservationCount: 0,
  usableObservationCount: 0,
  excludedObservationCount: 0,
  firstObservationDate: nothingDto(),
  latestObservationDate: nothingDto(),
  messages: [sameCurrencyReason],
})

const dateRangeViewModel = (
  requested: ResolvedDateRange,
  effective: ResolvedDateRange,
): AnalysisDateRangeDto => {
  const aligned = requested.endDate !== effective.endDate

  return {
    requested: {
      startDate: requested.startDate,
      endDate: requested.endDate,
      source: requested.source,
    },
    effective: {
      startDate: effective.startDate,
      endDate: effective.endDate,
      aligned,
      note: matchBoolean<MaybeDto<string>>({
        false: () => nothingDto(),
        true: () =>
          justDto(
            `End date aligned to the previous ${friendlyPreviousToleranceDays.toString()}-day provider window.`,
          ),
      })(aligned),
    },
  }
}

const keyResult = (key: string, label: string, metric: AnalysisMetricValueDto) =>
  matchDtoTag<MaybeDto<string>, ReadonlyArray<{ readonly key: string, readonly label: string, readonly value: string }>>({
    Just: (value) => [{ key, label, value: value.value }],
    Nothing: () => [],
  })(metric.displayValue)

const keyResults = (metrics: PairAnalysisMetricsDto) => [
  ...keyResult('latestReferenceRate', 'Latest reference rate', metrics.latestReferenceRate),
  ...keyResult('periodMovement', 'Period movement', metrics.periodMovement),
  ...keyResult('typicalMovement', 'Typical movement', metrics.typicalMovement),
]

const caveats = [
  'Reference rates may differ from live market, bank, card or payment-service rates.',
  'Historical observations are not forward-filled when provider dates are missing.',
]

const applicableViewModel = (
  input: ValidatedAnalysisInput,
  series: ApplicableRateSeries,
  requestedObservationCount: number,
): PairAnalysisViewModelDto => {
  const levelStats = calculateRateLevelStats(series.observations)
  const movementStats = calculateMovementStats(series.observations)
  const metrics = metricsFromStats(levelStats, movementStats)
  const dataQuality = seriesDataQuality(requestedObservationCount, series)
  const summary = chartSummary(input.pair, series.observations.length)
  const workedSolutionContext = { levelStats, movementStats, metrics }

  return {
    mode: 'pair-analysis',
    pair: {
      base: toCurrencySummary(input.pair.base),
      quote: toCurrencySummary(input.pair.quote),
      label: `${input.pair.base}/${input.pair.quote}`,
    },
    dateRange: dateRangeViewModel(input.requestedDateRange, input.effectiveDateRange),
    chart: {
      title: `${input.pair.base}/${input.pair.quote} reference-rate history`,
      summary,
      points: series.observations.map(chartPoint),
      tableCaption: `${input.pair.base}/${input.pair.quote} cleaned observations`,
    },
    metrics,
    dataQuality,
    insight: withDefault(summary)(fromNullable(dataQuality.messages[0])),
    calculationExplanations: analysisFormulaEntries.map(explanation(workedSolutionContext)),
    caveats,
    attribution,
    aiContextSeed: {
      mode: 'pair-analysis',
      selectedCurrencies: { base: input.pair.base, quotes: [input.pair.quote] },
      selectedDateRange: justDto(dateRangeViewModel(input.requestedDateRange, input.effectiveDateRange).effective),
      keyResults: keyResults(metrics),
      computedStats: justDto({
        observationCount: dataQuality.usableObservationCount,
        dataQualityStatus: dataQuality.status,
      }),
      chartSummary: justDto(summary),
      formulaSummaries: formulaSummariesForMetrics(analysisFormulaEntries.map((entry) => entry.metricKey)),
      appDisclaimers: caveats,
    },
  }
}

const sameCurrencyViewModel = (input: ValidatedAnalysisInput): PairAnalysisViewModelDto => {
  const metrics = sameCurrencyMetrics()
  const dateRange = dateRangeViewModel(input.requestedDateRange, input.effectiveDateRange)
  const workedSolutionContext = emptyWorkedSolutionContext(metrics)

  return {
    mode: 'pair-analysis',
    pair: {
      base: toCurrencySummary(input.pair.base),
      quote: toCurrencySummary(input.pair.quote),
      label: `${input.pair.base}/${input.pair.quote}`,
    },
    dateRange,
    chart: {
      title: `${input.pair.base}/${input.pair.quote} reference-rate history`,
      summary: sameCurrencyReason,
      points: [],
      tableCaption: `${input.pair.base}/${input.pair.quote} cleaned observations`,
    },
    metrics,
    dataQuality: sameCurrencyDataQuality(),
    insight: sameCurrencyReason,
    calculationExplanations: analysisFormulaEntries.map(explanation(workedSolutionContext)),
    caveats,
    attribution,
    aiContextSeed: {
      mode: 'pair-analysis',
      selectedCurrencies: { base: input.pair.base, quotes: [input.pair.quote] },
      selectedDateRange: justDto(dateRange.effective),
      keyResults: keyResults(metrics),
      computedStats: justDto({ observationCount: 0, dataQualityStatus: 'same-currency' }),
      chartSummary: justDto(sameCurrencyReason),
      formulaSummaries: formulaSummariesForMetrics(analysisFormulaEntries.map((entry) => entry.metricKey)),
      appDisclaimers: caveats,
    },
  }
}

const toViewModel = (
  input: ValidatedAnalysisInput,
  requestedObservationCount: number,
  series: DerivedRateSeries,
): PairAnalysisViewModelDto =>
  matchTag<DerivedRateSeries, PairAnalysisViewModelDto>({
    applicable: (applicableSeries) => applicableViewModel(input, applicableSeries, requestedObservationCount),
    'not-applicable': () => sameCurrencyViewModel(input),
  })(series)

const requestedObservationCount = (series: DerivedRateSeries): number =>
  matchTag<DerivedRateSeries, number>({
    applicable: (applicableSeries) =>
      applicableSeries.observations.length + applicableSeries.excludedObservationCount,
    'not-applicable': () => 0,
  })(series)

export const analyse =
  (deps: AnalysisDeps) =>
  (input: AnalyseRequestDto): AsyncResult<AnalysisError, PairAnalysisViewModelDto> =>
    matchResult<AnalysisError, ValidatedAnalysisInput, AsyncResult<AnalysisError, PairAnalysisViewModelDto>>({
      failure: (error) => Promise.resolve(failure(error)),
      success: (validated) =>
        resolveRateSeries(deps, validated)
          .then(mapResult((series) => toViewModel(validated, requestedObservationCount(series), series))),
    })(validateInput(deps, input))
