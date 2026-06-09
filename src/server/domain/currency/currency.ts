import { failure, success, type Result } from '@/shared/fp'

export type CurrencyCode = string & { readonly CurrencyCode: unique symbol }

export type CurrencyValidationError = {
  readonly tag: 'currency-validation-error'
  readonly code: string
  readonly message: string
}

export type SupportedCurrency = {
  readonly code: CurrencyCode
  readonly name: string
  readonly symbol: string
}

export type SupportedCurrencyCatalogue = {
  readonly currencies: ReadonlyArray<SupportedCurrency>
}

const makeCurrencyCode = (code: string): CurrencyCode => code as CurrencyCode

const supportedCodes = ['AUD', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'JPY', 'PHP', 'USD'] as const

export const staticSafeCurrencyCatalogue: SupportedCurrencyCatalogue = {
  currencies: [
    { code: makeCurrencyCode('AUD'), name: 'Australian dollar', symbol: 'A$' },
    { code: makeCurrencyCode('CAD'), name: 'Canadian dollar', symbol: 'C$' },
    { code: makeCurrencyCode('CHF'), name: 'Swiss franc', symbol: 'CHF' },
    { code: makeCurrencyCode('CNY'), name: 'Chinese yuan', symbol: 'CN¥' },
    { code: makeCurrencyCode('EUR'), name: 'Euro', symbol: '€' },
    { code: makeCurrencyCode('GBP'), name: 'British pound', symbol: '£' },
    { code: makeCurrencyCode('JPY'), name: 'Japanese yen', symbol: '¥' },
    { code: makeCurrencyCode('PHP'), name: 'Philippine peso', symbol: '₱' },
    { code: makeCurrencyCode('USD'), name: 'US dollar', symbol: '$' },
  ],
}

const unsupportedCurrency = (candidate: string): CurrencyValidationError => ({
  tag: 'currency-validation-error',
  code: 'UNSUPPORTED_CURRENCY',
  message: `${candidate} is not in the supported currency catalogue.`,
})

// parseCurrencyCode :: SupportedCurrencyCatalogue -> string -> Result<CurrencyValidationError, CurrencyCode>
export const parseCurrencyCode =
  (catalogue: SupportedCurrencyCatalogue) =>
  (candidate: string): Result<CurrencyValidationError, CurrencyCode> => {
    const normalised = candidate.toUpperCase()
    const isSupported = catalogue.currencies.some((currency) => currency.code === normalised)

    return ({
      false: failure(unsupportedCurrency(normalised)),
      true: success(makeCurrencyCode(normalised)),
    })[String(isSupported) as 'false' | 'true']
  }

export const defaultSupportedCurrencyCodes: ReadonlyArray<string> = supportedCodes
