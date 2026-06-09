import { failure, success, type Result } from '@/shared/fp'
import type { CurrencyCode } from '@/server/domain/currency/currency'

export type MoneyInput = number & { readonly MoneyInput: unique symbol }

export type CurrencyPair = {
  readonly base: CurrencyCode
  readonly quote: CurrencyCode
}

export type ConversionMode = 'provider' | 'same-currency'

export type ConversionResult = {
  readonly amount: MoneyInput
  readonly base: CurrencyCode
  readonly quote: CurrencyCode
  readonly rate: number
  readonly convertedAmount: number
  readonly effectiveDate: string | null
  readonly sourcePair: string
  readonly mode: ConversionMode
}

export type ConversionError =
  | {
      readonly tag: 'invalid-json'
      readonly message: string
    }
  | {
      readonly tag: 'invalid-request-shape'
      readonly field: string
      readonly message: string
    }
  | {
      readonly tag: 'invalid-amount'
      readonly field: 'amount'
      readonly message: string
    }
  | {
      readonly tag: 'unsupported-currency'
      readonly field: 'base' | 'quote'
      readonly candidate: string
      readonly message: string
    }
  | {
      readonly tag: 'provider-unavailable'
      readonly message: string
    }
  | {
      readonly tag: 'provider-payload-invalid'
      readonly message: string
    }

const makeMoney = (amount: number): MoneyInput => amount as MoneyInput

const invalidAmount: ConversionError = {
  tag: 'invalid-amount',
  field: 'amount',
  message: 'Enter an amount greater than 0.',
}

const booleanResult = <E, A>(predicate: boolean, error: E, value: A): Result<E, A> =>
  ({
    false: failure(error),
    true: success(value),
  })[String(predicate) as 'false' | 'true']

export const makeMoneyInput = (amount: number): Result<ConversionError, MoneyInput> =>
  booleanResult(Number.isFinite(amount) && amount > 0, invalidAmount, makeMoney(amount))

export const makeCurrencyPair = (base: CurrencyCode, quote: CurrencyCode): Result<ConversionError, CurrencyPair> =>
  success({ base, quote })

export const isSameCurrencyPair = (pair: CurrencyPair): boolean => pair.base === pair.quote

export const calculateConvertedAmount = (amount: MoneyInput, rate: number): number => amount * rate
