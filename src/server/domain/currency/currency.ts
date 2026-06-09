import { failure, fromNullable, matchMaybe, success, type Result } from '@/shared/fp'

export type CurrencyCode = 'AUD' | 'CAD' | 'CHF' | 'CNY' | 'EUR' | 'GBP' | 'JPY' | 'PHP' | 'USD'

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

const supportedCodes: ReadonlyArray<CurrencyCode> = ['AUD', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'JPY', 'PHP', 'USD']

export const staticSafeCurrencyCatalogue: SupportedCurrencyCatalogue = {
  currencies: [
    { code: 'AUD', name: 'Australian dollar', symbol: 'A$' },
    { code: 'CAD', name: 'Canadian dollar', symbol: 'C$' },
    { code: 'CHF', name: 'Swiss franc', symbol: 'CHF' },
    { code: 'CNY', name: 'Chinese yuan', symbol: 'CN¥' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese yen', symbol: '¥' },
    { code: 'PHP', name: 'Philippine peso', symbol: '₱' },
    { code: 'USD', name: 'US dollar', symbol: '$' },
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
    const supportedCurrency = catalogue.currencies.find((currency) => currency.code === normalised)

    return matchMaybe<SupportedCurrency, Result<CurrencyValidationError, CurrencyCode>>({
      none: () => failure(unsupportedCurrency(normalised)),
      some: (currency) => success(currency.code),
    })(fromNullable(supportedCurrency))
  }

export const defaultSupportedCurrencyCodes: ReadonlyArray<string> = supportedCodes
