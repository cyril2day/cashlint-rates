import type {
  IndexedComparisonChartViewModelDto,
  IndexedComparisonPointDto,
} from '@/shared/dto/comparison'
import {
  chainResult,
  failure,
  fromNullable,
  mapResult,
  matchBoolean,
  matchMaybe,
  sequenceResult,
  success,
  type Result,
} from '@/shared/fp'

export type IndexedComparisonChartInput = IndexedComparisonChartViewModelDto

export type IndexedComparisonChartError =
  | {
      readonly tag: 'empty-series'
      readonly message: string
    }
  | {
      readonly tag: 'invalid-point'
      readonly message: string
    }

export type IndexedComparisonSeriesPoint = {
  readonly date: string
  readonly quote: string
  readonly indexedValue: number
  readonly displayIndexedValue: string
  readonly actualRate: number
  readonly displayActualRate: string
}

export type IndexedComparisonSeries = {
  readonly quote: string
  readonly points: ReadonlyArray<IndexedComparisonSeriesPoint>
}

export type ValidatedIndexedComparisonChart = {
  readonly title: string
  readonly summary: string
  readonly series: ReadonlyArray<IndexedComparisonSeries>
}

const emptySeriesError: IndexedComparisonChartError = {
  tag: 'empty-series',
  message: 'An indexed comparison chart needs at least one point.',
}

const invalidPointError: IndexedComparisonChartError = {
  tag: 'invalid-point',
  message: 'Every indexed comparison point needs a date, quote, finite index value, and finite actual rate.',
}

const hasText = (value: string): boolean => value.trim().length > 0

const isFiniteNumber = (value: number): boolean => Number.isFinite(value)

const validPoint = (point: IndexedComparisonPointDto): boolean =>
  [hasText(point.date), hasText(point.quote), isFiniteNumber(point.indexedValue), isFiniteNumber(point.actualRate)]
    .every((value) => value)

const validatePoint = (
  point: IndexedComparisonPointDto,
): Result<IndexedComparisonChartError, IndexedComparisonSeriesPoint> =>
  matchBoolean<Result<IndexedComparisonChartError, IndexedComparisonSeriesPoint>>({
    false: () => failure(invalidPointError),
    true: () => success(point),
  })(validPoint(point))

const uniqueQuotes = (points: ReadonlyArray<IndexedComparisonSeriesPoint>): ReadonlyArray<string> =>
  Array.from(new Set(points.map((point) => point.quote)))

const pointsForQuote =
  (points: ReadonlyArray<IndexedComparisonSeriesPoint>) =>
  (quote: string): IndexedComparisonSeries => ({
    quote,
    points: points.filter((point) => point.quote === quote),
  })

const buildSeries = (
  points: ReadonlyArray<IndexedComparisonSeriesPoint>,
): ReadonlyArray<IndexedComparisonSeries> =>
  uniqueQuotes(points).map(pointsForQuote(points))

const validatedChart =
  (input: IndexedComparisonChartInput) =>
  (points: ReadonlyArray<IndexedComparisonSeriesPoint>): ValidatedIndexedComparisonChart => ({
    title: input.title,
    summary: input.summary,
    series: buildSeries(points),
  })

const validateNonEmpty = (
  input: IndexedComparisonChartInput,
): Result<IndexedComparisonChartError, IndexedComparisonChartInput> =>
  matchMaybe<IndexedComparisonPointDto, Result<IndexedComparisonChartError, IndexedComparisonChartInput>>({
    none: () => failure(emptySeriesError),
    some: () => success(input),
  })(fromNullable(input.points[0]))

const validatePoints = (
  input: IndexedComparisonChartInput,
): Result<IndexedComparisonChartError, ReadonlyArray<IndexedComparisonSeriesPoint>> =>
  sequenceResult(input.points.map(validatePoint))

export const validateIndexedComparisonChart = (
  input: IndexedComparisonChartInput,
): Result<IndexedComparisonChartError, ValidatedIndexedComparisonChart> =>
  chainResult<IndexedComparisonChartError, IndexedComparisonChartInput, ValidatedIndexedComparisonChart>(
    (nonEmptyInput) => mapResult(validatedChart(nonEmptyInput))(validatePoints(nonEmptyInput)),
  )(validateNonEmpty(input))
