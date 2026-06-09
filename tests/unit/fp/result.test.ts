import { describe, expect, it } from 'vitest'
import { chainResult, failure, mapResult, sequenceResult, success } from '@/shared/fp'

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
})
