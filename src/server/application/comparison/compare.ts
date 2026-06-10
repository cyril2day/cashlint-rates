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
import { isSameCurrencyPair, type CurrencyPair } from '@/server/domain/rates/conversion'
import {
  deriveRateSeries,
  type ApplicableRateSeries,
  type DerivedRateSeries,
  type RateDerivationError,
  type RateObservation,
} from '@/server/domain/rates/rate-derivation'
import { calculateMovementStats } from '@/server/domain/statistics/movement-statistics'
import type { ExchangeRateProvider, HistoricalRateData, ProviderError } from '@/server/ports/rate-provider'
import { addCalendarDays, isIsoDateBefore } from '@/shared/date'
import type { AnalysisDateRangeDto, AnalyseDateRangeRequestDto, DataQualityDto } from '@/shared/dto/analysis'
import type { ISODateStringDto, MaybeDto } from '@/shared/dto/api'
import type {
  CompareRequestDto,
  ComparisonDataQualityDto,
  ComparisonExclusionReasonDto,
  ComparisonMetricKey,
  ComparisonMetricUnitDto,
  ComparisonMetricValueDto,
  ComparisonQuoteInclusionDto,
  ComparisonQuoteRowDto,
  ComparisonRankingsDto,
  ComparisonViewModelDto,
  IndexedComparisonPointDto,
  RankedQuoteDto,
} from '@/shared/dto/comparison'
import {
  booleanKey,
  chainResult,
  failure,
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
  sequenceResult,
  success,
  type AsyncResult,
  type Maybe,
  type Result,
} from '@/shared/fp'

type ComparisonDeps = {
  readonly exchangeRateProvider: ExchangeRateProvider
  readonly today: ISODateStringDto
}

type ValidatedComparisonInput = {
  readonly base: CurrencyCode
  readonly quotes: ReadonlyArray<CurrencyCode>
  readonly requestedDateRange: ResolvedDateRange
  readonly effectiveDateRange: ResolvedDateRange
}

type QuoteSeriesResult = {
  readonly quote: CurrencyCode
  readonly requestedObservationCount: number
  readonly series: Result<ComparisonError, DerivedRateSeries>
}

type RankableRow = {
  readonly row: ComparisonQuoteRowDto
  readonly relativeVariability: number
  readonly periodMovement: number
}

export type ComparisonError =
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
      readonly field: 'base' | 'quotes'
      readonly candidate: string
      readonly message: string
    }
  | {
      readonly tag: 'no-quotes-selected'
      readonly message: string
    }
  | {
      readonly tag: 'quote-limit-exceeded'
      readonly limit: number
      readonly message: string
    }
  | {
      readonly tag: 'duplicate-quote-currency'
      readonly quote: string
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

const quoteLimit = 10
const notEnoughData = 'Not enough usable historical observations for this metric.'
const sameCurrencyReason =
  'Same-currency comparison is 1:1, so movement and variability rankings are not applicable.'
const providerUnavailableReason = 'Historical reference-rate data was unavailable for this quote.'

const attribution = {
  label: 'Exchange-rate data powered by Frankfurter.',
  sourceName: 'Frankfurter',
  sourceUrl: 'https://www.frankfurter.app/',
}

const caveats = [
  'Each comparison line starts at 100 so relative movement is easier to compare.',
  'Reference rates may differ from live market, bank, card or payment-service rates.',
  'Rankings describe the selected historical period only and are not forecasts or recommendations.',
]

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
  minimumFractionDigits: 0,
})

const percentFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const maybeDto = <A>(maybe: Maybe<A>): MaybeDto<A> =>
  matchMaybe<A, MaybeDto<A>>({
    none: () => ({ _tag: 'Nothing' }),
    some: (value) => ({ _tag: 'Just', value }),
  })(maybe)

const justDto = <A>(value: A): MaybeDto<A> => ({ _tag: 'Just', value })

const nothingDto = <A>(): MaybeDto<A> => ({ _tag: 'Nothing' })

const currencyName = (code: CurrencyCode): string =>
  staticSafeCurrencyCatalogue.currencies.find((currency) => currency.code === code)?.name ?? code

const toCurrencySummary = (code: CurrencyCode): SupportedCurrency => ({
  code,
  name: currencyName(code),
  symbol: staticSafeCurrencyCatalogue.currencies.find((currency) => currency.code === code)?.symbol ?? code,
})

const displayRate = (value: number): string => numberFormat.format(value)

const displayPercent = (value: number): string => `${percentFormat.format(value)}%`

const displayValue =
  (unit: ComparisonMetricUnitDto) =>
  (value: number): string =>
    ({
      percent: () => displayPercent(value),
      rate: () => displayRate(value),
    })[unit]()

const availableMetric = (
  metricKey: ComparisonMetricKey,
  value: number,
  unit: ComparisonMetricUnitDto,
): ComparisonMetricValueDto => ({
  _tag: 'ComparisonMetricValue',
  metricKey,
  rawValue: justDto(value),
  displayValue: justDto(displayValue(unit)(value)),
  unit: justDto(unit),
  availability: { _tag: 'Available' },
  warnings: [],
})

const unavailableMetric = (
  metricKey: ComparisonMetricKey,
  reason: string,
): ComparisonMetricValueDto => ({
  _tag: 'ComparisonMetricValue',
  metricKey,
  rawValue: nothingDto(),
  displayValue: nothingDto(),
  unit: nothingDto(),
  availability: { _tag: 'Unavailable', reason },
  warnings: [],
})

const notApplicableMetric = (
  metricKey: ComparisonMetricKey,
  reason: string,
): ComparisonMetricValueDto => ({
  _tag: 'ComparisonMetricValue',
  metricKey,
  rawValue: nothingDto(),
  displayValue: nothingDto(),
  unit: nothingDto(),
  availability: { _tag: 'NotApplicable', reason },
  warnings: [],
})

const metricFromMaybe = (
  metricKey: ComparisonMetricKey,
  unit: ComparisonMetricUnitDto,
  maybe: Maybe<number>,
  unavailableReason: string,
): ComparisonMetricValueDto =>
  matchMaybe<number, ComparisonMetricValueDto>({
    none: () => unavailableMetric(metricKey, unavailableReason),
    some: (value) => availableMetric(metricKey, value, unit),
  })(maybe)

const unsupportedCurrency = (field: 'base' | 'quotes', candidate: string): ComparisonError => ({
  tag: 'unsupported-currency',
  field,
  candidate,
  message: `${candidate.toUpperCase()} is not in the supported currency catalogue.`,
})

const parseInputCurrency = (
  field: 'base' | 'quotes',
  candidate: string,
): Result<ComparisonError, CurrencyCode> =>
  mapFailure(() => unsupportedCurrency(field, candidate))(
    parseCurrencyCode(staticSafeCurrencyCatalogue)(candidate),
  )

const dateRangeErrorToComparisonError = (error: DateRangeError): ComparisonError => ({
  tag: 'date-range-error',
  error,
})

const customDateRangeRequest = (
  range: Extract<AnalyseDateRangeRequestDto, { readonly _tag: 'Custom' }>,
): Result<ComparisonError, DateRangeRequest> =>
  success(customDateRange(range.startDate, range.endDate))

const presetDateRangeRequest = (
  range: Extract<AnalyseDateRangeRequestDto, { readonly _tag: 'Preset' }>,
): Result<ComparisonError, DateRangeRequest> => {
  const parsedPreset = mapFailure(dateRangeErrorToComparisonError)(parseDateRangePreset(range.preset))

  return mapResult(presetDateRange)(parsedPreset)
}

const dtoDateRangeRequest = (
  input: AnalyseDateRangeRequestDto,
): Result<ComparisonError, DateRangeRequest> =>
  matchDtoTag<AnalyseDateRangeRequestDto, Result<ComparisonError, DateRangeRequest>>({
    Custom: customDateRangeRequest,
    Preset: presetDateRangeRequest,
  })(input)

const duplicateQuote = (quotes: ReadonlyArray<string>): Maybe<string> => {
  const duplicated = quotes.find((quote, index) => quotes.indexOf(quote) !== index)

  return fromNullable(duplicated)
}

type QuoteCountState = 'empty' | 'overLimit' | 'valid'

const quoteCountState = (quotes: ReadonlyArray<string>): QuoteCountState =>
  matchBoolean<QuoteCountState>({
    false: () =>
      matchBoolean<QuoteCountState>({
        false: () => 'valid',
        true: () => 'overLimit',
      })(quotes.length > quoteLimit),
    true: () => 'empty',
  })(quotes.length === 0)

const quoteCountValidation: Readonly<Record<QuoteCountState, (quotes: ReadonlyArray<string>) => Result<ComparisonError, ReadonlyArray<string>>>> = {
  empty: () =>
    failure<ComparisonError>({
      tag: 'no-quotes-selected',
      message: 'Select at least one quote currency to compare.',
    }),
  overLimit: () =>
    failure<ComparisonError>({
      tag: 'quote-limit-exceeded',
      limit: quoteLimit,
      message: 'You can compare up to 10 quote currencies at once to keep the chart readable.',
    }),
  valid: success,
}

const validateQuoteCount = (quotes: ReadonlyArray<string>): Result<ComparisonError, ReadonlyArray<string>> =>
  quoteCountValidation[quoteCountState(quotes)](quotes)

const validateUniqueQuotes = (
  quotes: ReadonlyArray<string>,
): Result<ComparisonError, ReadonlyArray<string>> =>
  matchMaybe<string, Result<ComparisonError, ReadonlyArray<string>>>({
    none: () => success(quotes),
    some: (quote) =>
      failure({
        tag: 'duplicate-quote-currency',
        quote,
        message: `${quote} was selected more than once.`,
      }),
  })(duplicateQuote(quotes))

const validateQuotes = (quotes: ReadonlyArray<string>): Result<ComparisonError, ReadonlyArray<CurrencyCode>> => {
  const validQuoteCount = validateQuoteCount(quotes)
  const uniqueQuotes = validateDuplicateQuotesResult(validQuoteCount)

  return parseValidatedQuotes(uniqueQuotes)
}

const parseValidatedQuotes = (
  uniqueQuotes: Result<ComparisonError, ReadonlyArray<string>>,
): Result<ComparisonError, ReadonlyArray<CurrencyCode>> =>
  chainResult<ComparisonError, ReadonlyArray<string>, ReadonlyArray<CurrencyCode>>((quotes) =>
    sequenceResult(quotes.map((quote) => parseInputCurrency('quotes', quote))),
  )(uniqueQuotes)

const validateDuplicateQuotesResult = (
  quoteCount: Result<ComparisonError, ReadonlyArray<string>>,
): Result<ComparisonError, ReadonlyArray<string>> =>
  chainResult<ComparisonError, ReadonlyArray<string>, ReadonlyArray<string>>(validateUniqueQuotes)(quoteCount)

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
  quotes: ReadonlyArray<CurrencyCode>,
  requestedDateRange: ResolvedDateRange,
  effectiveDateRange: ResolvedDateRange,
): ValidatedComparisonInput => ({
  base,
  quotes,
  requestedDateRange,
  effectiveDateRange,
})

const resolveComparisonDateRange =
  (deps: ComparisonDeps) =>
  (dateRangeRequest: DateRangeRequest): Result<ComparisonError, ResolvedDateRange> =>
    mapFailure(dateRangeErrorToComparisonError)(resolveDateRange(dateRangeRequest, deps.today))

const validatedInputFromResolvedRange =
  (deps: ComparisonDeps, input: CompareRequestDto) =>
  (range: ResolvedDateRange): Result<ComparisonError, ValidatedComparisonInput> =>
    liftResult2((base: CurrencyCode, quotes: ReadonlyArray<CurrencyCode>) =>
      validatedInput(base, quotes, range, alignDateRange(range, deps.today)))(
      parseInputCurrency('base', input.base),
      validateQuotes(input.quotes),
    )

const validateInput = (
  deps: ComparisonDeps,
  input: CompareRequestDto,
): Result<ComparisonError, ValidatedComparisonInput> => {
  const dateRangeRequest = dtoDateRangeRequest(input.dateRange)
  const resolvedRange = chainResult<ComparisonError, DateRangeRequest, ResolvedDateRange>(
    resolveComparisonDateRange(deps),
  )(dateRangeRequest)

  return chainResult<ComparisonError, ResolvedDateRange, ValidatedComparisonInput>(
    validatedInputFromResolvedRange(deps, input),
  )(resolvedRange)
}

const providerErrorToComparisonError = (error: ProviderError): ComparisonError =>
  ((category: Readonly<Record<ProviderError['tag'], ComparisonError>>) => category)({
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

const rateDerivationErrorToComparisonError = (error: RateDerivationError): ComparisonError => ({
  tag: 'rate-derivation-unavailable',
  message: error.message,
})

const sameCurrencySeries = (pair: CurrencyPair): DerivedRateSeries => ({
  tag: 'not-applicable',
  reason: 'same-currency',
  base: pair.base,
  quote: pair.quote,
  observations: [],
  excludedObservations: [],
  excludedObservationCount: 0,
  message: 'Same-currency conversion is always 1:1, so historical movement statistics are not applicable.',
})

const emptyHistoricalRates = (
  input: ValidatedComparisonInput,
  quote: CurrencyCode,
): HistoricalRateData => ({
  base: input.base,
  quote,
  startDate: input.effectiveDateRange.startDate,
  endDate: input.effectiveDateRange.endDate,
  observations: [],
  sourcePair: `${input.base}/${quote}`,
})

const fetchProviderHistoricalRates = (
  deps: ComparisonDeps,
  input: ValidatedComparisonInput,
  quote: CurrencyCode,
): AsyncResult<ProviderError, HistoricalRateData> =>
  deps.exchangeRateProvider.getHistoricalRates({
    base: input.base,
    quote,
    startDate: input.effectiveDateRange.startDate,
    endDate: input.effectiveDateRange.endDate,
  })

const historicalRatesForPair = (
  deps: ComparisonDeps,
  input: ValidatedComparisonInput,
  pair: CurrencyPair,
): AsyncResult<ProviderError, HistoricalRateData> =>
  matchBoolean<AsyncResult<ProviderError, HistoricalRateData>>({
    false: () => fetchProviderHistoricalRates(deps, input, pair.quote),
    true: () => Promise.resolve(success(emptyHistoricalRates(input, pair.quote))),
  })(isSameCurrencyPair(pair))

const deriveQuoteSeries = (
  pair: CurrencyPair,
  providerResult: Result<ProviderError, HistoricalRateData>,
): Result<ComparisonError, DerivedRateSeries> =>
  matchBoolean<Result<ComparisonError, DerivedRateSeries>>({
    false: () => deriveProviderQuoteSeries(pair, providerResult),
    true: () => success(sameCurrencySeries(pair)),
  })(isSameCurrencyPair(pair))

const deriveProviderQuoteSeries = (
  pair: CurrencyPair,
  providerResult: Result<ProviderError, HistoricalRateData>,
): Result<ComparisonError, DerivedRateSeries> => {
  const historicalRates = mapFailure(providerErrorToComparisonError)(providerResult)

  return chainResult<ComparisonError, HistoricalRateData, DerivedRateSeries>(
    deriveHistoricalRateSeries(pair),
  )(historicalRates)
}

const deriveHistoricalRateSeries =
  (pair: CurrencyPair) =>
  (historicalRates: HistoricalRateData): Result<ComparisonError, DerivedRateSeries> =>
    mapFailure(rateDerivationErrorToComparisonError)(
      deriveRateSeries({ requestedPair: pair, historicalRates }),
    )

const requestedObservationCount = (
  providerResult: Result<ProviderError, HistoricalRateData>,
): number =>
  matchResult<ProviderError, HistoricalRateData, number>({
    failure: () => 0,
    success: (historicalRates) => historicalRates.observations.length,
  })(providerResult)

const fetchQuoteSeries =
  (deps: ComparisonDeps, input: ValidatedComparisonInput) =>
  async (quote: CurrencyCode): Promise<QuoteSeriesResult> => {
    const pair = { base: input.base, quote }
    const providerResult = await historicalRatesForPair(deps, input, pair)

    return {
      quote,
      requestedObservationCount: requestedObservationCount(providerResult),
      series: deriveQuoteSeries(pair, providerResult),
    }
  }

const firstObservationDate = (observations: ReadonlyArray<RateObservation>): Maybe<ISODateStringDto> =>
  mapMaybe((observation: RateObservation) => observation.date)(fromNullable(observations[0]))

const latestObservationDate = (observations: ReadonlyArray<RateObservation>): Maybe<ISODateStringDto> =>
  mapMaybe((observation: RateObservation) => observation.date)(
    fromNullable(observations[observations.length - 1]),
  )

const completeOrPartialStatusByKey: Readonly<Record<'false' | 'true', DataQualityDto['status']>> = {
  false: 'complete',
  true: 'partial-data',
}

const noDataOrLimitedStatusByKey: Readonly<Record<'false' | 'true', DataQualityDto['status']>> = {
  false: 'limited-data',
  true: 'no-data',
}

const completeOrPartialStatus = (excludedObservationCount: number): DataQualityDto['status'] =>
  completeOrPartialStatusByKey[booleanKey(excludedObservationCount > 0)]

const noDataOrLimitedStatus = (usableObservationCount: number): DataQualityDto['status'] =>
  noDataOrLimitedStatusByKey[booleanKey(usableObservationCount === 0)]

const dataQualityStatus = (
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

const applicableDataQuality = (
  requestedObservationCount: number,
  series: ApplicableRateSeries,
): DataQualityDto => {
  const status = dataQualityStatus(series.observations.length, series.excludedObservationCount)

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

const unavailableDataQuality = (message: string): DataQualityDto => ({
  status: 'no-data',
  requestedObservationCount: 0,
  usableObservationCount: 0,
  excludedObservationCount: 0,
  firstObservationDate: nothingDto(),
  latestObservationDate: nothingDto(),
  messages: [message],
})

const sameCurrencyDataQuality = (): DataQualityDto => ({
  status: 'same-currency',
  requestedObservationCount: 0,
  usableObservationCount: 0,
  excludedObservationCount: 0,
  firstObservationDate: nothingDto(),
  latestObservationDate: nothingDto(),
  messages: [sameCurrencyReason],
})

const inclusion = (
  dataQuality: DataQualityDto,
  relativeVariability: ComparisonMetricValueDto,
): ComparisonQuoteInclusionDto =>
  matchBoolean<ComparisonQuoteInclusionDto>({
    false: () =>
      ((handlers: Readonly<Record<DataQualityDto['status'], () => ComparisonQuoteInclusionDto>>) => handlers)({
        complete: () => ({ _tag: 'IncludedInRankings' }),
        'limited-data': () => ({ _tag: 'ExcludedFromRankings', reason: 'insufficient-observations' }),
        'no-data': () => ({ _tag: 'ExcludedFromRankings', reason: 'provider-data-unavailable' }),
        'partial-data': () => ({ _tag: 'ExcludedFromRankings', reason: 'partial-data' }),
        'same-currency': () => ({ _tag: 'ExcludedFromRankings', reason: 'same-currency' }),
      })[dataQuality.status](),
    true: () => ({ _tag: 'ExcludedFromRankings', reason: 'insufficient-observations' }),
  })(relativeVariability.rawValue._tag === 'Nothing')

const applicableRow = (quoteResult: QuoteSeriesResult, series: ApplicableRateSeries): ComparisonQuoteRowDto => {
  const movementStats = calculateMovementStats(series.observations)
  const latestRate = mapMaybe((observation: RateObservation) => observation.rate)(
    fromNullable(series.observations[series.observations.length - 1]),
  )
  const latestReferenceRate = metricFromMaybe('latest-reference-rate', 'rate', latestRate, notEnoughData)
  const periodMovement = metricFromMaybe(
    'period-movement',
    'percent',
    movementStats.periodMovementPercent,
    notEnoughData,
  )
  const relativeVariability = metricFromMaybe(
    'relative-variability',
    'percent',
    movementStats.typicalMovementPercent,
    notEnoughData,
  )
  const dataQuality = applicableDataQuality(quoteResult.requestedObservationCount, series)

  return {
    quote: toCurrencySummary(quoteResult.quote),
    latestReferenceRate,
    periodMovement,
    relativeVariability,
    inclusion: inclusion(dataQuality, relativeVariability),
    dataQuality,
  }
}

const sameCurrencyRow = (quote: CurrencyCode): ComparisonQuoteRowDto => {
  const dataQuality = sameCurrencyDataQuality()
  const relativeVariability = notApplicableMetric('relative-variability', sameCurrencyReason)

  return {
    quote: toCurrencySummary(quote),
    latestReferenceRate: availableMetric('latest-reference-rate', 1, 'rate'),
    periodMovement: notApplicableMetric('period-movement', sameCurrencyReason),
    relativeVariability,
    inclusion: inclusion(dataQuality, relativeVariability),
    dataQuality,
  }
}

const unavailableRow =
  (reason: ComparisonExclusionReasonDto, message: string) =>
  (quote: CurrencyCode): ComparisonQuoteRowDto => {
    const dataQuality = unavailableDataQuality(message)

    return {
      quote: toCurrencySummary(quote),
      latestReferenceRate: unavailableMetric('latest-reference-rate', message),
      periodMovement: unavailableMetric('period-movement', message),
      relativeVariability: unavailableMetric('relative-variability', message),
      inclusion: { _tag: 'ExcludedFromRankings', reason },
      dataQuality,
    }
  }

const rowFromQuoteResult = (quoteResult: QuoteSeriesResult): ComparisonQuoteRowDto =>
  matchResult<ComparisonError, DerivedRateSeries, ComparisonQuoteRowDto>({
    failure: () => unavailableRow('provider-data-unavailable', providerUnavailableReason)(quoteResult.quote),
    success: matchTag<DerivedRateSeries, ComparisonQuoteRowDto>({
      applicable: (series) => applicableRow(quoteResult, series),
      'not-applicable': () => sameCurrencyRow(quoteResult.quote),
    }),
  })(quoteResult.series)

const maybeRaw = (metric: ComparisonMetricValueDto): Maybe<number> =>
  matchDtoTag<MaybeDto<number>, Maybe<number>>({
    Just: (value) => ({ tag: 'some', value: value.value }),
    Nothing: () => ({ tag: 'none' }),
  })(metric.rawValue)

const maybeValues = <A>(maybe: Maybe<A>): ReadonlyArray<A> =>
  matchMaybe<A, ReadonlyArray<A>>({
    none: () => [],
    some: (value) => [value],
  })(maybe)

const metricRawValues = (metric: ComparisonMetricValueDto): ReadonlyArray<number> =>
  maybeValues(maybeRaw(metric))

const rankableFromValues = (
  row: ComparisonQuoteRowDto,
  relativeVariability: number,
  periodMovement: number,
): RankableRow => ({
  row,
  relativeVariability,
  periodMovement,
})

const rankableRowsForPeriodValues = (
  row: ComparisonQuoteRowDto,
  relativeVariability: number,
  periodMovements: ReadonlyArray<number>,
): ReadonlyArray<RankableRow> =>
  periodMovements.map((periodMovement) => rankableFromValues(row, relativeVariability, periodMovement))

const rankableRowsForRelativeValues = (
  row: ComparisonQuoteRowDto,
  relativeVariabilities: ReadonlyArray<number>,
  periodMovements: ReadonlyArray<number>,
): ReadonlyArray<RankableRow> =>
  relativeVariabilities.flatMap((relativeVariability) =>
    rankableRowsForPeriodValues(row, relativeVariability, periodMovements),
  )

const rankableFromMetrics = (row: ComparisonQuoteRowDto): ReadonlyArray<RankableRow> =>
  rankableRowsForRelativeValues(
    row,
    metricRawValues(row.relativeVariability),
    metricRawValues(row.periodMovement),
  )

const includedRankableRow = (row: ComparisonQuoteRowDto): ReadonlyArray<RankableRow> =>
  rankableFromMetrics(row)

const rankableRow = (row: ComparisonQuoteRowDto): ReadonlyArray<RankableRow> =>
  matchDtoTag<ComparisonQuoteInclusionDto, ReadonlyArray<RankableRow>>({
    ExcludedFromRankings: () => [],
    IncludedInRankings: () => includedRankableRow(row),
  })(row.inclusion)

const rankedQuote =
  (metric: (row: RankableRow) => ComparisonMetricValueDto) =>
  (row: RankableRow, index: number): RankedQuoteDto => ({
    quote: row.row.quote,
    metric: metric(row),
    rank: index + 1,
  })

const rankedFirstQuote =
  (metric: (row: RankableRow) => ComparisonMetricValueDto) =>
  (row: RankableRow): RankedQuoteDto =>
    rankedQuote(metric)(row, 0)

const firstRankedQuote = (
  rows: ReadonlyArray<RankableRow>,
  metric: (row: RankableRow) => ComparisonMetricValueDto,
): MaybeDto<RankedQuoteDto> =>
  maybeDto(mapMaybe(rankedFirstQuote(metric))(fromNullable(rows[0])))

const latestRankedQuote = (
  rows: ReadonlyArray<RankableRow>,
  metric: (row: RankableRow) => ComparisonMetricValueDto,
): MaybeDto<RankedQuoteDto> =>
  maybeDto(mapMaybe(rankedFirstQuote(metric))(fromNullable(rows[rows.length - 1])))

const rankings = (rows: ReadonlyArray<ComparisonQuoteRowDto>): ComparisonRankingsDto => {
  const rankableRows = rows.flatMap(rankableRow)
  const stability = [...rankableRows].sort((left, right) => left.relativeVariability - right.relativeVariability)
  const movementAscending = [...rankableRows].sort((left, right) => left.periodMovement - right.periodMovement)
  const movementDescending = [...movementAscending].reverse()

  return {
    mostStableQuote: firstRankedQuote(stability, (row) => row.row.relativeVariability),
    mostVariableQuote: latestRankedQuote(stability, (row) => row.row.relativeVariability),
    periodMovementAscending: movementAscending.map(rankedQuote((row) => row.row.periodMovement)),
    periodMovementDescending: movementDescending.map(rankedQuote((row) => row.row.periodMovement)),
  }
}

const indexedPoint =
  (quote: CurrencyCode, firstRate: number) =>
  (observation: RateObservation): IndexedComparisonPointDto => {
    const indexedValue = (observation.rate / firstRate) * 100

    return {
      date: observation.date,
      quote,
      indexedValue,
      displayIndexedValue: displayRate(indexedValue),
      actualRate: observation.rate,
      displayActualRate: displayRate(observation.rate),
    }
  }

const indexedPointsFromObservations = (
  quote: CurrencyCode,
  firstRate: number,
  observations: ReadonlyArray<RateObservation>,
): ReadonlyArray<IndexedComparisonPointDto> =>
  observations.map(indexedPoint(quote, firstRate))

const applicableIndexedPoints = (
  quote: CurrencyCode,
  series: ApplicableRateSeries,
): ReadonlyArray<IndexedComparisonPointDto> =>
  matchMaybe<RateObservation, ReadonlyArray<IndexedComparisonPointDto>>({
    none: () => [],
    some: (firstObservation) =>
      indexedPointsFromObservations(quote, firstObservation.rate, series.observations),
  })(fromNullable(series.observations[0]))

const indexedPointsFromDerivedSeries =
  (quote: CurrencyCode) =>
  (series: DerivedRateSeries): ReadonlyArray<IndexedComparisonPointDto> =>
    matchTag<DerivedRateSeries, ReadonlyArray<IndexedComparisonPointDto>>({
      applicable: (applicableSeries) => applicableIndexedPoints(quote, applicableSeries),
      'not-applicable': () => [],
    })(series)

const indexedPointsFromSeries = (quoteResult: QuoteSeriesResult): ReadonlyArray<IndexedComparisonPointDto> =>
  matchResult<ComparisonError, DerivedRateSeries, ReadonlyArray<IndexedComparisonPointDto>>({
    failure: () => [],
    success: indexedPointsFromDerivedSeries(quoteResult.quote),
  })(quoteResult.series)

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

const overallStatus = (rows: ReadonlyArray<ComparisonQuoteRowDto>): DataQualityDto['status'] =>
  ((handlers: Readonly<Record<'false' | 'true', () => DataQualityDto['status']>>) => handlers)({
    false: () =>
      matchBoolean<DataQualityDto['status']>({
        false: () => 'complete',
        true: () => 'partial-data',
      })(rows.some((row) => row.dataQuality.status !== 'complete')),
    true: () => 'no-data',
  })[booleanKey(rows.every((row) => row.dataQuality.status === 'no-data'))]()

const comparisonDataQuality = (rows: ReadonlyArray<ComparisonQuoteRowDto>): ComparisonDataQualityDto => {
  const status = overallStatus(rows)

  return {
    overall: {
      status,
      requestedObservationCount: rows.reduce((total, row) => total + row.dataQuality.requestedObservationCount, 0),
      usableObservationCount: rows.reduce((total, row) => total + row.dataQuality.usableObservationCount, 0),
      excludedObservationCount: rows.reduce((total, row) => total + row.dataQuality.excludedObservationCount, 0),
      firstObservationDate: nothingDto(),
      latestObservationDate: nothingDto(),
      messages: [dataQualityMessage(status)],
    },
    byQuote: rows.map((row) => ({ quote: row.quote.code, dataQuality: row.dataQuality })),
  }
}

const keyResults = (ranked: ComparisonRankingsDto) => [
  ...rankedQuoteKeyResult('mostStableQuote', 'Most stable quote', ranked.mostStableQuote),
  ...rankedQuoteKeyResult('mostVariableQuote', 'Most variable quote', ranked.mostVariableQuote),
]

const rankedQuoteKeyResult = (
  key: string,
  label: string,
  rankedQuote: MaybeDto<RankedQuoteDto>,
): ReadonlyArray<{ readonly key: string, readonly label: string, readonly value: string }> =>
  matchDtoTag<MaybeDto<RankedQuoteDto>, ReadonlyArray<{ readonly key: string, readonly label: string, readonly value: string }>>({
    Just: (ranked) => [{ key, label, value: ranked.value.quote.code }],
    Nothing: () => [],
  })(rankedQuote)

const rankedPairInsight = (stable: RankedQuoteDto, variable: MaybeDto<RankedQuoteDto>): string =>
  matchDtoTag<MaybeDto<RankedQuoteDto>, string>({
    Just: (ranked) =>
      `Among quotes with sufficient data, ${stable.quote.code} had the lowest relative variability and ${ranked.value.quote.code} had the highest.`,
    Nothing: () => 'Only one quote had sufficient data for variability ranking.',
  })(variable)

const insight = (ranked: ComparisonRankingsDto): string =>
  matchDtoTag<MaybeDto<RankedQuoteDto>, string>({
    Just: (stable) => rankedPairInsight(stable.value, ranked.mostVariableQuote),
    Nothing: () => 'No selected quote had enough clean observations for variability ranking.',
  })(ranked.mostStableQuote)

const viewModel = (
  input: ValidatedComparisonInput,
  quoteResults: ReadonlyArray<QuoteSeriesResult>,
): ComparisonViewModelDto => {
  const rows = quoteResults.map(rowFromQuoteResult)
  const ranked = rankings(rows)
  const points = quoteResults.flatMap(indexedPointsFromSeries)
  const dataQuality = comparisonDataQuality(rows)
  const chartSummary = `Comparison uses ${points.length.toString()} indexed points across ${input.quotes.length.toString()} selected quote currencies.`

  return {
    mode: 'comparison',
    base: toCurrencySummary(input.base),
    quotes: input.quotes.map(toCurrencySummary),
    dateRange: dateRangeViewModel(input.requestedDateRange, input.effectiveDateRange),
    chart: {
      title: `${input.base} indexed comparison`,
      summary: chartSummary,
      points,
      tableCaption: `${input.base} comparison indexed to 100`,
    },
    rows,
    rankings: ranked,
    dataQuality,
    insight: insight(ranked),
    calculationExplanations: [],
    caveats,
    attribution,
    aiContextSeed: {
      mode: 'comparison',
      selectedCurrencies: { base: input.base, quotes: input.quotes },
      selectedDateRange: justDto(dateRangeViewModel(input.requestedDateRange, input.effectiveDateRange).effective),
      keyResults: keyResults(ranked),
      computedStats: justDto({
        rankableQuoteCount: rows.flatMap(rankableRow).length,
        dataQualityStatus: dataQuality.overall.status,
      }),
      chartSummary: justDto(chartSummary),
      formulaSummaries: [],
      appDisclaimers: caveats,
    },
  }
}

const compareValidated =
  (deps: ComparisonDeps) =>
  async (input: ValidatedComparisonInput): AsyncResult<ComparisonError, ComparisonViewModelDto> => {
    const quoteResults = await Promise.all(input.quotes.map(fetchQuoteSeries(deps, input)))

    return success(viewModel(input, quoteResults))
  }

export const compare =
  (deps: ComparisonDeps) =>
  (input: CompareRequestDto): AsyncResult<ComparisonError, ComparisonViewModelDto> =>
    matchResult<ComparisonError, ValidatedComparisonInput, AsyncResult<ComparisonError, ComparisonViewModelDto>>({
      failure: (error) => Promise.resolve(failure(error)),
      success: compareValidated(deps),
    })(validateInput(deps, input))
