import { describe, expect, it } from 'vitest'
import {
  chainResult,
  failure,
  liftResult2,
  liftResult3,
  mapFailure,
  mapResult,
  sequenceResult,
  success,
} from '@/shared/fp'

describe('Result foundation', () => {
  it('maps successful values without touching failures', () => {
    expect(mapResult((value: number) => value + 1)(success(1))).toEqual(success(2))
    expect(mapResult((value: number) => value + 1)(failure('nope'))).toEqual(failure('nope'))
  })

  it('chains dependent results', () => {
    const requirePositive = (value: number) =>
      value > 0 ? success(value) : failure('not-positive')

    expect(chainResult(requirePositive)(success(4))).toEqual(success(4))
    expect(chainResult(requirePositive)(success(0))).toEqual(failure('not-positive'))
  })

  it('sequences arrays of results', () => {
    expect(sequenceResult([success('USD'), success('GBP')])).toEqual(success(['USD', 'GBP']))
    expect(sequenceResult([success('USD'), failure('bad')])).toEqual(failure('bad'))
  })

  it('maps failures without touching successes', () => {
    const prefix = (error: string) => `error:${error}`

    expect(mapFailure(prefix)(failure('bad'))).toEqual(failure('error:bad'))
    expect(mapFailure(prefix)(success(10))).toEqual(success(10))
  })

  it('lifts independent results into typed product values', () => {
    const pair = (base: string, quote: string) => ({ base, quote })
    const triple = (amount: number, base: string, quote: string) => ({ amount, base, quote })

    expect(liftResult2(pair)(success('USD'), success('GBP'))).toEqual(success({ base: 'USD', quote: 'GBP' }))
    expect(liftResult3(triple)(success(100), success('USD'), success('GBP'))).toEqual(
      success({ amount: 100, base: 'USD', quote: 'GBP' }),
    )
    expect(liftResult3(triple)(success(100), failure('bad-base'), success('GBP'))).toEqual(failure('bad-base'))
  })
})
