import type { RateObservation } from '@/server/domain/rates/rate-derivation'
import { allTrue, booleanKey, fromNullable, matchMaybe, none, some, type Maybe, withDefault } from '@/shared/fp'

export type LogReturnObservation = {
  readonly fromDate: string
  readonly toDate: string
  readonly value: number
}

export type MovementDisplayStrength =
  | 'unavailable'
  | 'limited'
  | 'cautious'
  | 'standard'

export type MovementStats = {
  readonly returnObservationCount: number
  readonly periodMovementPercent: Maybe<number>
  readonly meanLogReturn: Maybe<number>
  readonly sampleStdDevLogReturn: Maybe<number>
  readonly typicalMovementPercent: Maybe<number>
  readonly displayStrength: MovementDisplayStrength
  readonly logReturns: ReadonlyArray<LogReturnObservation>
}

type LogReturnState = {
  readonly previousObservation: Maybe<RateObservation>
  readonly logReturns: ReadonlyArray<LogReturnObservation>
}

type DisplayStrengthRule = {
  readonly strength: MovementDisplayStrength
  readonly matches: (returnObservationCount: number) => boolean
}

const displayStrengthRules: ReadonlyArray<DisplayStrengthRule> = [
  { strength: 'unavailable', matches: (count) => count === 0 },
  { strength: 'limited', matches: (count) => allTrue([count >= 1, count <= 5]) },
  { strength: 'cautious', matches: (count) => allTrue([count >= 6, count <= 28]) },
  { strength: 'standard', matches: (count) => count >= 29 },
]

const unavailableDisplayStrength: MovementDisplayStrength = 'unavailable'

const sum = (values: ReadonlyArray<number>): number =>
  values.reduce((total, value) => total + value, 0)

const meanValue = (values: ReadonlyArray<number>): number =>
  sum(values) / values.length

const lazyMinimumCountNumberMaybe = (
  values: ReadonlyArray<number>,
  minimumCount: number,
  project: (availableValues: ReadonlyArray<number>) => number,
): Maybe<number> =>
  ({
    false: () => none<number>(),
    true: () => some(project(values)),
  })[booleanKey(values.length >= minimumCount)]()

const appendLogReturn = (
  state: LogReturnState,
  observation: RateObservation,
): LogReturnState =>
  matchMaybe<RateObservation, LogReturnState>({
    none: () => ({
      previousObservation: some(observation),
      logReturns: state.logReturns,
    }),
    some: (previousObservation) => ({
      previousObservation: some(observation),
      logReturns: [
        ...state.logReturns,
        {
          fromDate: previousObservation.date,
          toDate: observation.date,
          value: Math.log(observation.rate / previousObservation.rate),
        },
      ],
    }),
  })(state.previousObservation)

const initialLogReturnState: LogReturnState = {
  previousObservation: none<RateObservation>(),
  logReturns: [],
}

// calculateLogReturns :: RateObservation[] -> LogReturnObservation[]
export const calculateLogReturns = (
  observations: ReadonlyArray<RateObservation>,
): ReadonlyArray<LogReturnObservation> =>
  observations.reduce(appendLogReturn, initialLogReturnState).logReturns

const periodMovementPercentValue = (
  observations: ReadonlyArray<RateObservation>,
): Maybe<number> =>
  lazyMinimumCountNumberMaybe(
    observations.map((observation) => observation.rate),
    1,
    (rates) => {
      const first = rates[0]
      const latest = rates[rates.length - 1]

      const l = withDefault(withDefault(0)(fromNullable(first)))(fromNullable(latest))
      const s = withDefault(0)(fromNullable(first))
      const d = withDefault(1)(fromNullable(first))

      return ((l - s) / d) * 100
    },
  )

const sampleStdDevValue = (values: ReadonlyArray<number>): number => {
  const mean = meanValue(values)
  const squaredDeviations = values.map((value) => (value - mean) ** 2)

  return Math.sqrt(sum(squaredDeviations) / (values.length - 1))
}

const sampleStdDevLogReturnValue = (
  logReturns: ReadonlyArray<LogReturnObservation>,
): Maybe<number> =>
  lazyMinimumCountNumberMaybe(
    logReturns.map((logReturn) => logReturn.value),
    2,
    sampleStdDevValue,
  )

const typicalMovementPercentValue = (
  sampleStdDevLogReturn: Maybe<number>,
): Maybe<number> =>
  matchMaybe<number, Maybe<number>>({
    none: () => none<number>(),
    some: (standardDeviation) => some(standardDeviation * 100),
  })(sampleStdDevLogReturn)

const meanLogReturnValue = (
  logReturns: ReadonlyArray<LogReturnObservation>,
): Maybe<number> =>
  lazyMinimumCountNumberMaybe(
    logReturns.map((logReturn) => logReturn.value),
    1,
    meanValue,
  )

const ruleStrengthCandidate =
  (returnObservationCount: number) =>
  (rule: DisplayStrengthRule): MovementDisplayStrength =>
    ({
      false: () => unavailableDisplayStrength,
      true: () => rule.strength,
    })[booleanKey(rule.matches(returnObservationCount))]()

const preferAvailableStrength = (
  current: MovementDisplayStrength,
  next: MovementDisplayStrength,
): MovementDisplayStrength =>
  ({
    false: () => current,
    true: () => next,
  })[booleanKey(current === 'unavailable')]()

const displayStrength = (returnObservationCount: number): MovementDisplayStrength =>
  displayStrengthRules
    .map(ruleStrengthCandidate(returnObservationCount))
    .reduce(preferAvailableStrength, unavailableDisplayStrength)

// calculateMovementStats :: RateObservation[] -> MovementStats
export const calculateMovementStats = (
  observations: ReadonlyArray<RateObservation>,
): MovementStats => {
  const logReturns = calculateLogReturns(observations)
  const sampleStdDevLogReturn = sampleStdDevLogReturnValue(logReturns)

  return {
    returnObservationCount: logReturns.length,
    periodMovementPercent: periodMovementPercentValue(observations),
    meanLogReturn: meanLogReturnValue(logReturns),
    sampleStdDevLogReturn,
    typicalMovementPercent: typicalMovementPercentValue(sampleStdDevLogReturn),
    displayStrength: displayStrength(logReturns.length),
    logReturns,
  }
}
