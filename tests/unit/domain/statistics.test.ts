import { describe, expect, it } from 'vitest'
import { parseCurrencyCode, staticSafeCurrencyCatalogue } from '@/server/domain/currency/currency'
import type { RateObservation } from '@/server/domain/rates/rate-derivation'
import { calculateRateLevelStats } from '@/server/domain/statistics/descriptive-statistics'
import { calculateMovementStats } from '@/server/domain/statistics/movement-statistics'
import type { ISODateStringDto } from '@/shared/dto/api'
import type { Maybe, Result } from '@/shared/fp'

const parse = parseCurrencyCode(staticSafeCurrencyCatalogue)

const expectSuccess = <E, A>(result: Result<E, A>): A => {
  if (result.tag === 'failure') {
    throw new Error(`Expected success result, got ${JSON.stringify(result.error)}`)
  }

  return result.value
}

const expectSome = <A>(maybe: Maybe<A>): A => {
  if (maybe.tag === 'none') {
    throw new Error('Expected Some, got None')
  }

  return maybe.value
}

const expectNone = <A>(maybe: Maybe<A>): void => {
  expect(maybe.tag).toBe('none')
}

const code = (candidate: string) => expectSuccess(parse(candidate))

const observationDates: ReadonlyArray<ISODateStringDto> = [
  '2026-01-01',
  '2026-01-02',
  '2026-01-03',
  '2026-01-04',
  '2026-01-05',
]

const rateObservation = (date: ISODateStringDto, rate: number): RateObservation => ({
  date,
  base: code('USD'),
  quote: code('PHP'),
  rate,
  derivation: {
    method: 'direct',
    requestedPair: 'USD/PHP',
    sourcePair: 'USD/PHP',
    displayedPair: 'USD/PHP',
    formula: { tag: 'none' },
  },
})

const observationsFromRates = (
  rates: ReadonlyArray<number>,
): ReadonlyArray<RateObservation> =>
  rates.map((rate, index) =>
    rateObservation(observationDates[index]!, rate),
  )

describe('statistics domain', () => {
  it('matches the deterministic increasing-series rate-level vector', () => {
    const stats = calculateRateLevelStats(observationsFromRates([10, 12, 14, 16, 18]))

    expect(stats.observationCount).toBe(5)
    expect(expectSome(stats.firstRate)).toBe(10)
    expect(expectSome(stats.latestRate)).toBe(18)
    expect(expectSome(stats.min)).toBe(10)
    expect(expectSome(stats.max)).toBe(18)
    expect(expectSome(stats.range)).toBe(8)
    expect(expectSome(stats.mean)).toBe(14)
    expect(expectSome(stats.median)).toBe(14)
    expect(expectSome(stats.populationStdDev)).toBeCloseTo(2.8284271247461903, 10)
    expect(expectSome(stats.percentilePosition)).toBe(100)
    expect(expectSome(stats.zScore)).toBeCloseTo(1.414213562373095, 10)
    expect(stats.unusualnessLabel).toBe('somewhat_away_from_typical')
  })

  it('matches the deterministic increasing-series movement vector', () => {
    const stats = calculateMovementStats(observationsFromRates([10, 12, 14, 16, 18]))

    expect(stats.returnObservationCount).toBe(4)
    const logReturnValues = stats.logReturns.map((logReturn) => logReturn.value)

    expect(logReturnValues[0]).toBeCloseTo(0.1823215568, 10)
    expect(logReturnValues[1]).toBeCloseTo(0.1541506798, 10)
    expect(logReturnValues[2]).toBeCloseTo(0.1335313926, 10)
    expect(logReturnValues[3]).toBeCloseTo(0.1177830357, 10)
    expect(expectSome(stats.periodMovementPercent)).toBe(80)
    expect(expectSome(stats.meanLogReturn)).toBeCloseTo(0.14694666622552974, 12)
    expect(expectSome(stats.sampleStdDevLogReturn)).toBeCloseTo(0.02789126272070071, 10)
    expect(expectSome(stats.typicalMovementPercent)).toBeCloseTo(2.789126272070071, 8)
    expect(stats.displayStrength).toBe('limited')
  })

  it('suppresses z-score for a constant series while keeping movement variability at zero', () => {
    const observations = observationsFromRates([1.25, 1.25, 1.25, 1.25])
    const rateStats = calculateRateLevelStats(observations)
    const movementStats = calculateMovementStats(observations)

    expect(rateStats.observationCount).toBe(4)
    expect(expectSome(rateStats.mean)).toBe(1.25)
    expect(expectSome(rateStats.median)).toBe(1.25)
    expect(expectSome(rateStats.min)).toBe(1.25)
    expect(expectSome(rateStats.max)).toBe(1.25)
    expect(expectSome(rateStats.range)).toBe(0)
    expect(expectSome(rateStats.populationStdDev)).toBe(0)
    expect(expectSome(rateStats.percentilePosition)).toBe(100)
    expectNone(rateStats.zScore)
    expect(rateStats.unusualnessLabel).toBe('not_applicable')
    expect(expectSome(movementStats.periodMovementPercent)).toBe(0)
    expect(movementStats.logReturns.map((logReturn) => logReturn.value)).toEqual([0, 0, 0])
    expect(expectSome(movementStats.sampleStdDevLogReturn)).toBe(0)
    expect(expectSome(movementStats.typicalMovementPercent)).toBe(0)
  })

  it('marks two observations as limited and withholds sample movement variability', () => {
    const rateStats = calculateRateLevelStats(observationsFromRates([100, 105]))
    const movementStats = calculateMovementStats(observationsFromRates([100, 105]))

    expect(rateStats.observationCount).toBe(2)
    expect(expectSome(rateStats.firstRate)).toBe(100)
    expect(expectSome(rateStats.latestRate)).toBe(105)
    expect(expectSome(rateStats.min)).toBe(100)
    expect(expectSome(rateStats.max)).toBe(105)
    expect(expectSome(rateStats.range)).toBe(5)
    expect(expectSome(rateStats.mean)).toBe(102.5)
    expect(expectSome(rateStats.median)).toBe(102.5)
    expect(expectSome(movementStats.periodMovementPercent)).toBe(5)
    expect(movementStats.returnObservationCount).toBe(1)
    expect(expectSome(movementStats.meanLogReturn)).toBeCloseTo(Math.log(105 / 100), 12)
    expectNone(movementStats.sampleStdDevLogReturn)
    expectNone(movementStats.typicalMovementPercent)
    expect(movementStats.displayStrength).toBe('limited')
  })

  it('returns unavailable statistics for empty observations', () => {
    const rateStats = calculateRateLevelStats([])
    const movementStats = calculateMovementStats([])

    expect(rateStats.observationCount).toBe(0)
    expectNone(rateStats.firstRate)
    expectNone(rateStats.latestRate)
    expectNone(rateStats.mean)
    expectNone(rateStats.median)
    expectNone(rateStats.populationStdDev)
    expectNone(rateStats.percentilePosition)
    expectNone(rateStats.zScore)
    expect(rateStats.unusualnessLabel).toBe('not_applicable')
    expect(movementStats.returnObservationCount).toBe(0)
    expectNone(movementStats.periodMovementPercent)
    expectNone(movementStats.meanLogReturn)
    expectNone(movementStats.sampleStdDevLogReturn)
    expectNone(movementStats.typicalMovementPercent)
    expect(movementStats.displayStrength).toBe('unavailable')
  })
})
