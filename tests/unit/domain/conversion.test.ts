import { describe, expect, it } from 'vitest'
import { parseCurrencyCode, staticSafeCurrencyCatalogue } from '@/server/domain/currency/currency'
import {
  calculateConvertedAmount,
  isSameCurrencyPair,
  makeCurrencyPair,
  makeMoneyInput,
  type MoneyInput,
} from '@/server/domain/rates/conversion'
import type { CurrencyCode } from '@/server/domain/currency/currency'
import type { Result } from '@/shared/fp'

const parse = parseCurrencyCode(staticSafeCurrencyCatalogue)

const expectSuccess = <E, A>(result: Result<E, A>): A => {
  if (result.tag === 'failure') {
    throw new Error('Expected success result')
  }

  return result.value
}

describe('conversion domain', () => {
  it('accepts positive finite amounts and rejects zero, negative, and non-finite amounts', () => {
    expect(makeMoneyInput(100).tag).toBe('success')
    expect(makeMoneyInput(0).tag).toBe('failure')
    expect(makeMoneyInput(-5).tag).toBe('failure')
    expect(makeMoneyInput(Number.POSITIVE_INFINITY).tag).toBe('failure')
  })

  it('keeps same-currency pairs valid and identifiable', () => {
    const usd: CurrencyCode = expectSuccess(parse('USD'))
    const pair = makeCurrencyPair(usd, usd)

    expect(pair.tag).toBe('success')
    expect(isSameCurrencyPair(expectSuccess(pair))).toBe(true)
  })

  it('calculates converted amount from amount and latest rate', () => {
    const amount: MoneyInput = expectSuccess(makeMoneyInput(1000))

    expect(calculateConvertedAmount(amount, 0.8)).toBe(800)
  })
})
