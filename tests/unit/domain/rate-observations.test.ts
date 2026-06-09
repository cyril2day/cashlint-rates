import { describe, expect, it } from 'vitest'
import { parseCurrencyCode, staticSafeCurrencyCatalogue } from '@/server/domain/currency/currency'
import type { CurrencyPair } from '@/server/domain/rates/conversion'
import { cleanHistoricalRateObservations } from '@/server/domain/rates/observations'
import {
  deriveRateSeries,
  type ApplicableRateSeries,
  type DerivedRateSeries,
} from '@/server/domain/rates/rate-derivation'
import type { HistoricalRateData } from '@/server/ports/rate-provider'
import type { Result } from '@/shared/fp'

const parse = parseCurrencyCode(staticSafeCurrencyCatalogue)

const expectSuccess = <E, A>(result: Result<E, A>): A => {
  if (result.tag === 'failure') {
    throw new Error(`Expected success result, got ${JSON.stringify(result.error)}`)
  }

  return result.value
}

const expectFailure = <E, A>(result: Result<E, A>): E => {
  if (result.tag === 'success') {
    throw new Error(`Expected failure result, got ${JSON.stringify(result.value)}`)
  }

  return result.error
}

const expectApplicableRateSeries = (series: DerivedRateSeries): ApplicableRateSeries => {
  if (series.tag !== 'applicable') {
    throw new Error(`Expected applicable series, got ${JSON.stringify(series)}`)
  }

  return series
}

const code = (candidate: string) => expectSuccess(parse(candidate))

const pair = (base: string, quote: string): CurrencyPair => ({
  base: code(base),
  quote: code(quote),
})

const historicalRates = (
  base: string,
  quote: string,
  observations: HistoricalRateData['observations'],
): HistoricalRateData => ({
  base: code(base),
  quote: code(quote),
  startDate: '2026-06-01',
  endDate: '2026-06-08',
  observations,
  sourcePair: `${base}/${quote}`,
})

describe('rate observation cleaning and derivation', () => {
  it('excludes null, non-finite, zero, and negative rates while preserving valid dates', () => {
    const result = cleanHistoricalRateObservations([
      { date: '2026-06-01', rate: 1.1 },
      { date: '2026-06-02', rate: null },
      { date: '2026-06-03', rate: Number.NaN },
      { date: '2026-06-04', rate: Number.POSITIVE_INFINITY },
      { date: '2026-06-05', rate: 0 },
      { date: '2026-06-06', rate: -1.2 },
      { date: '2026-06-08', rate: 1.3 },
    ])

    expect(result.observations).toEqual([
      { date: '2026-06-01', rate: 1.1 },
      { date: '2026-06-08', rate: 1.3 },
    ])
    expect(result.excludedObservationCount).toBe(5)
    expect(result.excludedObservations.map((observation) => observation.reason)).toEqual([
      'missing-rate',
      'non-finite-rate',
      'non-finite-rate',
      'non-positive-rate',
      'non-positive-rate',
    ])
  })

  it('keeps direct source rates in the requested pair direction', () => {
    const series = expectApplicableRateSeries(expectSuccess(
      deriveRateSeries({
        requestedPair: pair('USD', 'GBP'),
        historicalRates: historicalRates('USD', 'GBP', [
          { date: '2026-06-01', rate: 0.79 },
          { date: '2026-06-02', rate: null },
          { date: '2026-06-08', rate: 0.81 },
        ]),
      }),
    ))

    expect(series.tag).toBe('applicable')
    expect(series.observations.map((observation) => observation.rate)).toEqual([0.79, 0.81])
    expect(series.observations.map((observation) => observation.date)).toEqual([
      '2026-06-01',
      '2026-06-08',
    ])
    expect(series.excludedObservationCount).toBe(1)
    expect(series.derivation).toMatchObject({
      method: 'direct',
      requestedPair: 'USD/GBP',
      sourcePair: 'USD/GBP',
      displayedPair: 'USD/GBP',
    })
    expect(series.derivation.formula.tag).toBe('none')
  })

  it('derives inverse rates and labels the reciprocal formula', () => {
    const series = expectApplicableRateSeries(expectSuccess(
      deriveRateSeries({
        requestedPair: pair('USD', 'GBP'),
        historicalRates: historicalRates('GBP', 'USD', [
          { date: '2026-06-01', rate: 1.25 },
          { date: '2026-06-08', rate: 1.2 },
        ]),
      }),
    ))

    expect(series.tag).toBe('applicable')
    expect(series.observations.map((observation) => observation.rate)).toEqual([0.8, 0.8333333333333334])
    expect(series.derivation).toMatchObject({
      method: 'inverse',
      requestedPair: 'USD/GBP',
      sourcePair: 'GBP/USD',
      displayedPair: 'USD/GBP',
    })
    expect(series.derivation.formula).toEqual({ tag: 'some', value: '1 / sourceRate' })
  })

  it('returns a typed failure when source rates cannot produce the requested pair', () => {
    const error = expectFailure(
      deriveRateSeries({
        requestedPair: pair('USD', 'GBP'),
        historicalRates: historicalRates('EUR', 'JPY', [
          { date: '2026-06-01', rate: 160 },
        ]),
      }),
    )

    expect(error).toEqual({
      tag: 'pair-derivation-unavailable',
      requestedPair: 'USD/GBP',
      sourcePair: 'EUR/JPY',
      message: 'Cannot derive USD/GBP from EUR/JPY.',
    })
  })

  it('represents same-currency analysis as not applicable instead of missing observations', () => {
    const series = expectSuccess(
      deriveRateSeries({
        requestedPair: pair('USD', 'USD'),
        historicalRates: historicalRates('USD', 'GBP', [
          { date: '2026-06-01', rate: 0.79 },
        ]),
      }),
    )

    expect(series).toEqual({
      tag: 'not-applicable',
      reason: 'same-currency',
      base: code('USD'),
      quote: code('USD'),
      observations: [],
      excludedObservations: [],
      excludedObservationCount: 0,
      message: 'Same-currency conversion is always 1:1, so historical movement statistics are not applicable.',
    })
  })
})
