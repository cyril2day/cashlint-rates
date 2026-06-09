import type { HistoricalRateObservation } from '@/server/ports/rate-provider'
import type { ISODateStringDto } from '@/shared/dto/api'
import {
  allTrue,
  booleanKey,
  isFalse,
  lazyBooleanResult,
  matchResult,
  none,
  some,
  type Maybe,
  type Result,
} from '@/shared/fp'

export type PositiveRate = number

export type CleanSourceRateObservation = {
  readonly date: ISODateStringDto
  readonly rate: PositiveRate
}

export type ExcludedObservationReason =
  | 'missing-rate'
  | 'non-finite-rate'
  | 'non-positive-rate'

export type ExcludedRateObservation = {
  readonly date: ISODateStringDto
  readonly observedRate: Maybe<number>
  readonly reason: ExcludedObservationReason
}

export type ObservationCleaningResult = {
  readonly observations: ReadonlyArray<CleanSourceRateObservation>
  readonly excludedObservations: ReadonlyArray<ExcludedRateObservation>
  readonly excludedObservationCount: number
}

const toPositiveRate = (rate: number): PositiveRate => rate

const emptyCleaningResult: ObservationCleaningResult = {
  observations: [],
  excludedObservations: [],
  excludedObservationCount: 0,
}

const isFiniteNumberRate = (rate: HistoricalRateObservation['rate']): rate is number =>
  allTrue([typeof rate === 'number', Number.isFinite(rate)])

const isPositiveFiniteRate = (rate: HistoricalRateObservation['rate']): rate is number =>
  allTrue([isFiniteNumberRate(rate), Number(rate) > 0])

const nonMissingRateReasons: Readonly<Record<'false' | 'true', ExcludedObservationReason>> = {
  false: 'non-positive-rate',
  true: 'non-finite-rate',
}

const rateReasons: Readonly<Record<'false' | 'true', ExcludedObservationReason>> = {
  false: nonMissingRateReasons.false,
  true: 'missing-rate',
}

const rateCleaningReason = (
  rate: HistoricalRateObservation['rate'],
): ExcludedObservationReason =>
  ({
    false: () => nonMissingRateReasons[booleanKey(isFalse(isFiniteNumberRate(rate)))],
    true: () => rateReasons.true,
  })[booleanKey(rate === null)]()

const observedRateMaybe = (rate: HistoricalRateObservation['rate']): Maybe<number> =>
  ({
    false: () => none<number>(),
    true: () => some(Number(rate)),
  })[booleanKey(typeof rate === 'number')]()

const excludedObservation = (
  observation: HistoricalRateObservation,
): ExcludedRateObservation => ({
  date: observation.date,
  observedRate: observedRateMaybe(observation.rate),
  reason: rateCleaningReason(observation.rate),
})

const cleanSourceRateObservation = (
  observation: HistoricalRateObservation,
): CleanSourceRateObservation => ({
  date: observation.date,
  rate: toPositiveRate(Number(observation.rate)),
})

// cleanHistoricalRateObservation :: HistoricalRateObservation -> Result<ExcludedRateObservation, CleanSourceRateObservation>
export const cleanHistoricalRateObservation = (
  observation: HistoricalRateObservation,
): Result<ExcludedRateObservation, CleanSourceRateObservation> =>
  lazyBooleanResult(
    isPositiveFiniteRate(observation.rate),
    () => excludedObservation(observation),
    () => cleanSourceRateObservation(observation),
  )

const appendCleanObservation = (
  state: ObservationCleaningResult,
  observation: CleanSourceRateObservation,
): ObservationCleaningResult => ({
  observations: [...state.observations, observation],
  excludedObservations: state.excludedObservations,
  excludedObservationCount: state.excludedObservationCount,
})

const appendExcludedObservation = (
  state: ObservationCleaningResult,
  observation: ExcludedRateObservation,
): ObservationCleaningResult => ({
  observations: state.observations,
  excludedObservations: [...state.excludedObservations, observation],
  excludedObservationCount: state.excludedObservationCount + 1,
})

const appendObservationCleaningResult = (
  state: ObservationCleaningResult,
  observation: HistoricalRateObservation,
): ObservationCleaningResult =>
  matchResult<ExcludedRateObservation, CleanSourceRateObservation, ObservationCleaningResult>({
    failure: (excluded) => appendExcludedObservation(state, excluded),
    success: (cleaned) => appendCleanObservation(state, cleaned),
  })(cleanHistoricalRateObservation(observation))

// cleanHistoricalRateObservations :: HistoricalRateObservation[] -> ObservationCleaningResult
export const cleanHistoricalRateObservations = (
  observations: ReadonlyArray<HistoricalRateObservation>,
): ObservationCleaningResult =>
  observations.reduce(appendObservationCleaningResult, emptyCleaningResult)
