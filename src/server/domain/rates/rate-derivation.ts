import type { CurrencyCode } from '@/server/domain/currency/currency'
import type { CurrencyPair } from '@/server/domain/rates/conversion'
import { isSameCurrencyPair } from '@/server/domain/rates/conversion'
import {
  cleanHistoricalRateObservations,
  type CleanSourceRateObservation,
  type ExcludedRateObservation,
  type ObservationCleaningResult,
} from '@/server/domain/rates/observations'
import type { HistoricalRateData } from '@/server/ports/rate-provider'
import type { ISODateStringDto } from '@/shared/dto/api'
import { allTrue, failure, matchBoolean, none, some, success, type Maybe, type Result } from '@/shared/fp'

export type RateDerivationMethod = 'direct' | 'inverse'

export type RateDerivation = {
  readonly method: RateDerivationMethod
  readonly requestedPair: string
  readonly sourcePair: string
  readonly displayedPair: string
  readonly formula: Maybe<'1 / sourceRate'>
}

export type RateObservation = {
  readonly date: ISODateStringDto
  readonly base: CurrencyCode
  readonly quote: CurrencyCode
  readonly rate: number
  readonly derivation: RateDerivation
}

export type ApplicableRateSeries = {
  readonly tag: 'applicable'
  readonly base: CurrencyCode
  readonly quote: CurrencyCode
  readonly derivation: RateDerivation
  readonly observations: ReadonlyArray<RateObservation>
  readonly excludedObservations: ReadonlyArray<ExcludedRateObservation>
  readonly excludedObservationCount: number
}

export type SameCurrencyRateSeries = {
  readonly tag: 'not-applicable'
  readonly reason: 'same-currency'
  readonly base: CurrencyCode
  readonly quote: CurrencyCode
  readonly observations: ReadonlyArray<never>
  readonly excludedObservations: ReadonlyArray<never>
  readonly excludedObservationCount: 0
  readonly message: 'Same-currency conversion is always 1:1, so historical movement statistics are not applicable.'
}

export type DerivedRateSeries = ApplicableRateSeries | SameCurrencyRateSeries

export type RateDerivationError = {
  readonly tag: 'pair-derivation-unavailable'
  readonly requestedPair: string
  readonly sourcePair: string
  readonly message: string
}

export type RateSeriesDerivationInput = {
  readonly requestedPair: CurrencyPair
  readonly historicalRates: HistoricalRateData
}

type PairDerivationDecision = RateDerivationMethod | 'same-currency' | 'unavailable'

type PairDerivationRule = {
  readonly decision: PairDerivationDecision
  readonly matches: (input: RateSeriesDerivationInput) => boolean
}

const sameCurrencyMessage =
  'Same-currency conversion is always 1:1, so historical movement statistics are not applicable.'

const pairLabel = (base: CurrencyCode, quote: CurrencyCode): string => `${base}/${quote}`

const requestedPairLabel = (pair: CurrencyPair): string => pairLabel(pair.base, pair.quote)

const historicalRatePairLabel = (rates: HistoricalRateData): string =>
  pairLabel(rates.base, rates.quote)

const isDirectPair = (input: RateSeriesDerivationInput): boolean =>
  allTrue([
    input.requestedPair.base === input.historicalRates.base,
    input.requestedPair.quote === input.historicalRates.quote,
  ])

const isInversePair = (input: RateSeriesDerivationInput): boolean =>
  allTrue([
    input.requestedPair.base === input.historicalRates.quote,
    input.requestedPair.quote === input.historicalRates.base,
  ])

const pairDerivationRules: ReadonlyArray<PairDerivationRule> = [
  { decision: 'same-currency', matches: (input) => isSameCurrencyPair(input.requestedPair) },
  { decision: 'direct', matches: isDirectPair },
  { decision: 'inverse', matches: isInversePair },
]

const pairDerivationDecisionFromRule = (
  input: RateSeriesDerivationInput,
  rule: PairDerivationRule,
): PairDerivationDecision =>
  matchBoolean<PairDerivationDecision>({
    false: () => 'unavailable',
    true: () => rule.decision,
  })(rule.matches(input))

const preferAvailableDecision = (
  current: PairDerivationDecision,
  next: PairDerivationDecision,
): PairDerivationDecision =>
  matchBoolean<PairDerivationDecision>({
    false: () => current,
    true: () => next,
  })(current === 'unavailable')

const pairDerivationDecision = (input: RateSeriesDerivationInput): PairDerivationDecision =>
  pairDerivationRules
    .map((rule) => pairDerivationDecisionFromRule(input, rule))
    .reduce(preferAvailableDecision, 'unavailable')

const unavailableDerivation = (input: RateSeriesDerivationInput): RateDerivationError => ({
  tag: 'pair-derivation-unavailable',
  requestedPair: requestedPairLabel(input.requestedPair),
  sourcePair: historicalRatePairLabel(input.historicalRates),
  message: `Cannot derive ${requestedPairLabel(input.requestedPair)} from ${historicalRatePairLabel(input.historicalRates)}.`,
})

const derivationFormula = (
  method: RateDerivationMethod,
): Maybe<'1 / sourceRate'> =>
  ({
    direct: () => none<'1 / sourceRate'>(),
    inverse: () => some<'1 / sourceRate'>('1 / sourceRate'),
  })[method]()

const rateDerivation =
  (method: RateDerivationMethod) =>
  (input: RateSeriesDerivationInput): RateDerivation => ({
    method,
    requestedPair: requestedPairLabel(input.requestedPair),
    sourcePair: historicalRatePairLabel(input.historicalRates),
    displayedPair: requestedPairLabel(input.requestedPair),
    formula: derivationFormula(method),
  })

const deriveRateByMethod: Readonly<Record<RateDerivationMethod, (sourceRate: number) => number>> = {
  direct: (sourceRate) => sourceRate,
  inverse: (sourceRate) => 1 / sourceRate,
}

const deriveRateObservation =
  (
    requestedPair: CurrencyPair,
    derivation: RateDerivation,
  ) =>
  (observation: CleanSourceRateObservation): RateObservation => ({
    date: observation.date,
    base: requestedPair.base,
    quote: requestedPair.quote,
    rate: deriveRateByMethod[derivation.method](observation.rate),
    derivation,
  })

const sameCurrencyRateSeries = (pair: CurrencyPair): SameCurrencyRateSeries => ({
  tag: 'not-applicable',
  reason: 'same-currency',
  base: pair.base,
  quote: pair.quote,
  observations: [],
  excludedObservations: [],
  excludedObservationCount: 0,
  message: sameCurrencyMessage,
})

const applicableRateSeries =
  (method: RateDerivationMethod) =>
  (input: RateSeriesDerivationInput): ApplicableRateSeries => {
    const cleaningResult: ObservationCleaningResult = cleanHistoricalRateObservations(
      input.historicalRates.observations,
    )
    const derivation = rateDerivation(method)(input)

    return {
      tag: 'applicable',
      base: input.requestedPair.base,
      quote: input.requestedPair.quote,
      derivation,
      observations: cleaningResult.observations.map(
        deriveRateObservation(input.requestedPair, derivation),
      ),
      excludedObservations: cleaningResult.excludedObservations,
      excludedObservationCount: cleaningResult.excludedObservationCount,
    }
  }

const deriveRateSeriesByDecision: Readonly<
  Record<PairDerivationDecision, (input: RateSeriesDerivationInput) => Result<RateDerivationError, DerivedRateSeries>>
> = {
  direct: (input) => success(applicableRateSeries('direct')(input)),
  inverse: (input) => success(applicableRateSeries('inverse')(input)),
  'same-currency': (input) => success(sameCurrencyRateSeries(input.requestedPair)),
  unavailable: (input) => failure(unavailableDerivation(input)),
}

// deriveRateSeries :: RateSeriesDerivationInput -> Result<RateDerivationError, DerivedRateSeries>
export const deriveRateSeries = (
  input: RateSeriesDerivationInput,
): Result<RateDerivationError, DerivedRateSeries> =>
  deriveRateSeriesByDecision[pairDerivationDecision(input)](input)
