import { describe, expect, it } from 'vitest'
import {
  customDateRange,
  parseDateRangePreset,
  presetDateRange,
  resolveDateRange,
  resolvePresetDateRange,
} from '@/server/domain/date-range/date-range'
import type { DateRangeError, ResolvedDateRange } from '@/server/domain/date-range/date-range'
import type { Result } from '@/shared/fp'

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

describe('date-range domain', () => {
  it('parses recognised presets case-insensitively and rejects unknown presets', () => {
    expect(expectSuccess(parseDateRangePreset('7d'))).toBe('7D')
    expect(expectSuccess(parseDateRangePreset('30D'))).toBe('30D')
    expect(expectFailure(parseDateRangePreset('14D')).tag).toBe('unsupported-preset')
  })

  it('resolves presets into explicit start and end dates using the injected today', () => {
    const today = '2026-06-09'
    const ranges: ReadonlyArray<ResolvedDateRange> = [
      resolvePresetDateRange('7D', today),
      resolvePresetDateRange('30D', today),
      resolvePresetDateRange('90D', today),
      resolvePresetDateRange('1Y', today),
    ]

    expect(ranges).toEqual([
      { startDate: '2026-06-02', endDate: today, source: 'preset-7d' },
      { startDate: '2026-05-10', endDate: today, source: 'preset-30d' },
      { startDate: '2026-03-11', endDate: today, source: 'preset-90d' },
      { startDate: '2025-06-09', endDate: today, source: 'preset-1y' },
    ])
  })

  it('resolves preset requests after validating today', () => {
    expect(resolveDateRange(presetDateRange('7D'), '2026-02-30').tag).toBe('failure')
    expect(expectSuccess(resolveDateRange(presetDateRange('7D'), '2026-06-09'))).toEqual({
      startDate: '2026-06-02',
      endDate: '2026-06-09',
      source: 'preset-7d',
    })
  })

  it('accepts valid custom ranges without an artificial maximum span', () => {
    expect(expectSuccess(resolveDateRange(customDateRange('1999-01-01', '2026-06-09'), '2026-06-09'))).toEqual({
      startDate: '1999-01-01',
      endDate: '2026-06-09',
      source: 'custom',
    })
  })

  it('rejects impossible custom calendar dates', () => {
    const error: DateRangeError = expectFailure(
      resolveDateRange(customDateRange('2026-02-30', '2026-06-09'), '2026-06-09'),
    )

    expect(error).toMatchObject({
      tag: 'invalid-date',
      field: 'startDate',
    })
  })

  it('requires custom start dates to be before custom end dates', () => {
    const error: DateRangeError = expectFailure(
      resolveDateRange(customDateRange('2026-06-09', '2026-06-09'), '2026-06-09'),
    )

    expect(error).toMatchObject({
      tag: 'invalid-date-range',
      field: 'dateRange',
    })
  })

  it('rejects custom dates after today', () => {
    const startError: DateRangeError = expectFailure(
      resolveDateRange(customDateRange('2026-06-10', '2026-06-11'), '2026-06-09'),
    )
    const endError: DateRangeError = expectFailure(
      resolveDateRange(customDateRange('2026-06-08', '2026-06-10'), '2026-06-09'),
    )

    expect(startError).toMatchObject({
      tag: 'future-date',
      field: 'startDate',
    })
    expect(endError).toMatchObject({
      tag: 'future-date',
      field: 'endDate',
    })
  })
})
