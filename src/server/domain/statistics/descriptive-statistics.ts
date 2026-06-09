import type { RateObservation } from '@/server/domain/rates/rate-derivation'
import {
  allTrue,
  anyTrue,
  booleanKey,
  fromNullable,
  matchBoolean,
  matchMaybe,
  none,
  some,
  type Maybe,
} from '@/shared/fp'

export type UnusualnessLabel =
  | 'typical'
  | 'somewhat_away_from_typical'
  | 'unusual_for_period'
  | 'very_unusual_for_period'
  | 'not_applicable'

export type RateLevelStats = {
  readonly observationCount: number
  readonly firstRate: Maybe<number>
  readonly latestRate: Maybe<number>
  readonly min: Maybe<number>
  readonly max: Maybe<number>
  readonly range: Maybe<number>
  readonly mean: Maybe<number>
  readonly median: Maybe<number>
  readonly populationStdDev: Maybe<number>
  readonly percentilePosition: Maybe<number>
  readonly zScore: Maybe<number>
  readonly unusualnessLabel: UnusualnessLabel
}

type UnusualnessRule = {
  readonly label: UnusualnessLabel
  readonly matches: (absoluteZScore: number) => boolean
}

const constantSeriesUnusualnessMessage =
  'The observed rate did not vary in this selected period, so an unusualness score is not available.'

export const zScoreUnavailableReason = constantSeriesUnusualnessMessage

const notApplicableUnusualnessLabel: UnusualnessLabel = 'not_applicable'

const unusualnessRules: ReadonlyArray<UnusualnessRule> = [
  { label: 'typical', matches: (absoluteZScore) => absoluteZScore < 1 },
  {
    label: 'somewhat_away_from_typical',
    matches: (absoluteZScore) => allTrue([absoluteZScore >= 1, absoluteZScore < 2]),
  },
  {
    label: 'unusual_for_period',
    matches: (absoluteZScore) => allTrue([absoluteZScore >= 2, absoluteZScore < 3]),
  },
  { label: 'very_unusual_for_period', matches: (absoluteZScore) => absoluteZScore >= 3 },
]

const rates = (observations: ReadonlyArray<RateObservation>): ReadonlyArray<number> =>
  observations.map((observation) => observation.rate)

const sum = (values: ReadonlyArray<number>): number =>
  values.reduce((total, value) => total + value, 0)

const meanValue = (values: ReadonlyArray<number>): number =>
  sum(values) / values.length

const lazyNonEmptyNumberMaybe = (
  values: ReadonlyArray<number>,
  project: (nonEmptyValues: ReadonlyArray<number>) => number,
): Maybe<number> =>
  ({
    false: () => none<number>(),
    true: () => some(project(values)),
  })[booleanKey(values.length > 0)]()

const firstValue = (values: ReadonlyArray<number>): Maybe<number> =>
  fromNullable(values[0])

const latestValue = (values: ReadonlyArray<number>): Maybe<number> =>
  fromNullable(values[values.length - 1])

const minimumValue = (values: ReadonlyArray<number>): Maybe<number> =>
  lazyNonEmptyNumberMaybe(values, (nonEmptyValues) => Math.min(...nonEmptyValues))

const maximumValue = (values: ReadonlyArray<number>): Maybe<number> =>
  lazyNonEmptyNumberMaybe(values, (nonEmptyValues) => Math.max(...nonEmptyValues))

const sortedAscending = (values: ReadonlyArray<number>): ReadonlyArray<number> =>
  [...values].sort((first, second) => first - second)

const medianContributorPredicate =
  (count: number) =>
  (_value: number, index: number): boolean => {
    const middleIndex = Math.floor(count / 2)

    return matchBoolean<boolean>({
      false: () => anyTrue([index === middleIndex - 1, index === middleIndex]),
      true: () => index === middleIndex,
    })(count % 2 === 1)
  }

const medianValueFromNonEmpty = (values: ReadonlyArray<number>): number => {
  const sortedValues = sortedAscending(values)
  const contributors = sortedValues.filter(medianContributorPredicate(sortedValues.length))

  return meanValue(contributors)
}

const medianValue = (values: ReadonlyArray<number>): Maybe<number> =>
  lazyNonEmptyNumberMaybe(values, medianValueFromNonEmpty)

const rangeValue = (values: ReadonlyArray<number>): Maybe<number> =>
  lazyNonEmptyNumberMaybe(
    values,
    (nonEmptyValues) => Math.max(...nonEmptyValues) - Math.min(...nonEmptyValues),
  )

const squaredDeviation =
  (mean: number) =>
  (value: number): number =>
    (value - mean) ** 2

const populationStdDevValueFromNonEmpty = (values: ReadonlyArray<number>): number => {
  const mean = meanValue(values)

  return Math.sqrt(meanValue(values.map(squaredDeviation(mean))))
}

const populationStdDevValue = (values: ReadonlyArray<number>): Maybe<number> =>
  lazyNonEmptyNumberMaybe(values, populationStdDevValueFromNonEmpty)

const percentilePositionValue = (values: ReadonlyArray<number>): Maybe<number> =>
  matchMaybe<number, Maybe<number>>({
    none: () => none<number>(),
    some: (latest) =>
      some((values.filter((value) => value <= latest).length / values.length) * 100),
  })(latestValue(values))

const zScoreValue = (values: ReadonlyArray<number>): Maybe<number> =>
  lazyNonEmptyNumberMaybe(values, (nonEmptyValues) => {
    const standardDeviation = populationStdDevValueFromNonEmpty(nonEmptyValues)
    const mean = meanValue(nonEmptyValues)
    const latest = nonEmptyValues[nonEmptyValues.length - 1]

    return ((latest ?? mean) - mean) / standardDeviation
  })

const zScoreAvailability = (values: ReadonlyArray<number>): Maybe<number> =>
  matchMaybe<number, Maybe<number>>({
    none: () => none<number>(),
    some: (standardDeviation) =>
      ({
        false: () => none<number>(),
        true: () => zScoreValue(values),
      })[booleanKey(standardDeviation > 0)](),
  })(populationStdDevValue(values))

const ruleLabelCandidate =
  (absoluteZScore: number) =>
  (rule: UnusualnessRule): UnusualnessLabel =>
    ({
      false: () => notApplicableUnusualnessLabel,
      true: () => rule.label,
    })[booleanKey(rule.matches(absoluteZScore))]()

const preferApplicableLabel = (
  current: UnusualnessLabel,
  next: UnusualnessLabel,
): UnusualnessLabel =>
  ({
    false: () => current,
    true: () => next,
  })[booleanKey(current === 'not_applicable')]()

const unusualnessLabelFromZScore = (zScore: number): UnusualnessLabel =>
  unusualnessRules
    .map(ruleLabelCandidate(Math.abs(zScore)))
    .reduce(preferApplicableLabel, notApplicableUnusualnessLabel)

const unusualnessLabel = (zScore: Maybe<number>): UnusualnessLabel =>
  matchMaybe<number, UnusualnessLabel>({
    none: () => notApplicableUnusualnessLabel,
    some: unusualnessLabelFromZScore,
  })(zScore)

// calculateRateLevelStats :: RateObservation[] -> RateLevelStats
export const calculateRateLevelStats = (
  observations: ReadonlyArray<RateObservation>,
): RateLevelStats => {
  const observedRates = rates(observations)
  const zScore = zScoreAvailability(observedRates)

  return {
    observationCount: observedRates.length,
    firstRate: firstValue(observedRates),
    latestRate: latestValue(observedRates),
    min: minimumValue(observedRates),
    max: maximumValue(observedRates),
    range: rangeValue(observedRates),
    mean: lazyNonEmptyNumberMaybe(observedRates, meanValue),
    median: medianValue(observedRates),
    populationStdDev: populationStdDevValue(observedRates),
    percentilePosition: percentilePositionValue(observedRates),
    zScore,
    unusualnessLabel: unusualnessLabel(zScore),
  }
}
