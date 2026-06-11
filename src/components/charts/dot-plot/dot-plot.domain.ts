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

export type DotPlotPoint = {
  readonly id: string
  readonly xLabel: string
  readonly yValue: number
  readonly displayYValue: string
  readonly ariaLabel: string
}

export type DotPlotInput = {
  readonly points: ReadonlyArray<DotPlotPoint>
}

export type DotPlotError =
  | {
      readonly tag: 'empty-points'
      readonly message: string
    }
  | {
      readonly tag: 'invalid-point'
      readonly message: string
    }

export type ValidatedDotPlot = {
  readonly points: ReadonlyArray<DotPlotPoint>
}

const emptyPointsError: DotPlotError = {
  tag: 'empty-points',
  message: 'A dot plot needs at least one point.',
}

const invalidPointError: DotPlotError = {
  tag: 'invalid-point',
  message: 'Every dot plot point needs labels and a finite numeric value.',
}

const hasText = (value: string): boolean => value.trim().length > 0

const validPoint = (point: DotPlotPoint): boolean =>
  [
    hasText(point.id),
    hasText(point.xLabel),
    hasText(point.displayYValue),
    hasText(point.ariaLabel),
    Number.isFinite(point.yValue),
  ].every((value) => value)

const validatePoint = (point: DotPlotPoint): Result<DotPlotError, DotPlotPoint> =>
  matchBoolean<Result<DotPlotError, DotPlotPoint>>({
    false: () => failure(invalidPointError),
    true: () => success(point),
  })(validPoint(point))

const validateNonEmpty = (input: DotPlotInput): Result<DotPlotError, DotPlotInput> =>
  matchMaybe<DotPlotPoint, Result<DotPlotError, DotPlotInput>>({
    none: () => failure(emptyPointsError),
    some: () => success(input),
  })(fromNullable(input.points[0]))

const validatedDotPlot =
  (points: ReadonlyArray<DotPlotPoint>): ValidatedDotPlot => ({
    points,
  })

export const validateDotPlot = (input: DotPlotInput): Result<DotPlotError, ValidatedDotPlot> =>
  chainResult<DotPlotError, DotPlotInput, ValidatedDotPlot>(
    (nonEmptyInput) => mapResult(validatedDotPlot)(sequenceResult(nonEmptyInput.points.map(validatePoint))),
  )(validateNonEmpty(input))
