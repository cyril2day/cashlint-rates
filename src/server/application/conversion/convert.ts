import {
  calculateConvertedAmount,
  isSameCurrencyPair,
  makeMoneyInput,
  type ConversionError,
  type ConversionResult,
  type CurrencyPair,
  type MoneyInput,
} from '@/server/domain/rates/conversion'
import {
  parseCurrencyCode,
  staticSafeCurrencyCatalogue,
  type CurrencyCode,
  type SupportedCurrency,
} from '@/server/domain/currency/currency'
import type { ExchangeRateProvider, ProviderError } from '@/server/ports/rate-provider'
import type {
  ConvertRequestDto,
  ConversionViewModelDto,
  MetricValueDto,
  RateDerivationDto,
} from '@/shared/dto/conversion'
import {
  failure,
  foldMaybe,
  fromNullable,
  liftResult3,
  mapFailure,
  mapResult,
  matchBoolean,
  matchResult,
  success,
  type AsyncResult,
  type Maybe,
  type Result,
} from '@/shared/fp'

type ConversionDeps = {
  readonly exchangeRateProvider: ExchangeRateProvider
}

type ValidatedConversionInput = {
  readonly amount: MoneyInput
  readonly pair: CurrencyPair
}

const attribution = {
  label: 'Exchange-rate data powered by Frankfurter.',
  sourceName: 'Frankfurter',
  sourceUrl: 'https://www.frankfurter.app/',
}

const findCurrency = (
  code: CurrencyCode,
): Maybe<SupportedCurrency> =>
  fromNullable(
    staticSafeCurrencyCatalogue.currencies.find((currency) => currency.code === code),
  )

const currencyName = (code: CurrencyCode): string =>
  foldMaybe<SupportedCurrency, string>(code, (c) => c.name)(findCurrency(code))

const toCurrencySummary = (code: CurrencyCode): SupportedCurrency => ({
  code,
  name: currencyName(code),
  symbol: foldMaybe<SupportedCurrency, string>(code, (c) => c.symbol)(findCurrency(code)),
})

const unsupportedCurrency = (field: 'base' | 'quote', candidate: string): ConversionError => ({
  tag: 'unsupported-currency',
  field,
  candidate,
  message: `${candidate.toUpperCase()} is not in the supported currency catalogue.`,
})

const parseInputCurrency = (
  field: 'base' | 'quote',
  candidate: string,
): Result<ConversionError, CurrencyCode> =>
  mapFailure(() => unsupportedCurrency(field, candidate))(
    parseCurrencyCode(staticSafeCurrencyCatalogue)(candidate),
  )

const providerErrorToConversionError = (error: ProviderError): ConversionError =>
  ((category: Readonly<Record<ProviderError['tag'], ConversionError>>) => category)({
    'invalid-payload': {
      tag: 'provider-payload-invalid',
      message: 'The latest reference-rate payload could not be validated.',
    },
    network: {
      tag: 'provider-unavailable',
      message: 'We could not load the latest reference rate just now. Please try again.',
    },
    'rate-limit': {
      tag: 'provider-unavailable',
      message: 'The reference-rate provider is busy right now. Please try again.',
    },
    unavailable: {
      tag: 'provider-unavailable',
      message: 'We could not load the latest reference rate just now. Please try again.',
    },
  })[error.tag]

const sameCurrencyResult = (amount: MoneyInput, pair: CurrencyPair): ConversionResult => ({
  amount,
  base: pair.base,
  quote: pair.quote,
  rate: 1,
  convertedAmount: amount,
  effectiveDate: null,
  sourcePair: `${pair.base}/${pair.quote}`,
  mode: 'same-currency',
})

const providerResult =
  (deps: ConversionDeps, amount: MoneyInput) =>
  (pair: CurrencyPair): AsyncResult<ConversionError, ConversionResult> =>
    deps.exchangeRateProvider
      .getLatestRate(pair)
      .then(mapResult((rateData): ConversionResult => ({
        amount,
        base: pair.base,
        quote: pair.quote,
        rate: rateData.rate,
        convertedAmount: calculateConvertedAmount(amount, rateData.rate),
        effectiveDate: rateData.effectiveDate,
        sourcePair: rateData.sourcePair,
        mode: 'provider',
      })))
      .then(mapFailure(providerErrorToConversionError))

const convertValidated =
  (deps: ConversionDeps, amount: MoneyInput) =>
  (pair: CurrencyPair): AsyncResult<ConversionError, ConversionResult> =>
    matchBoolean<AsyncResult<ConversionError, ConversionResult>>({
      false: () => providerResult(deps, amount)(pair),
      true: () => Promise.resolve(success(sameCurrencyResult(amount, pair))),
    })(isSameCurrencyPair(pair))

const validatedConversionInput = (
  amount: MoneyInput,
  base: CurrencyCode,
  quote: CurrencyCode,
): ValidatedConversionInput => ({
  amount,
  pair: {
    base,
    quote,
  },
})

const validateInput = (input: ConvertRequestDto): Result<ConversionError, ValidatedConversionInput> =>
  liftResult3(validatedConversionInput)(
    makeMoneyInput(input.amount),
    parseInputCurrency('base', input.base),
    parseInputCurrency('quote', input.quote),
  )

export const convert =
  (deps: ConversionDeps) =>
  (input: ConvertRequestDto): AsyncResult<ConversionError, ConversionResult> =>
    matchResult<ConversionError, { readonly amount: MoneyInput, readonly pair: CurrencyPair }, AsyncResult<ConversionError, ConversionResult>>({
      failure: (error) => Promise.resolve(failure(error)),
      success: ({ amount, pair }) => convertValidated(deps, amount)(pair),
    })(validateInput(input))

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
  minimumFractionDigits: 0,
})

const moneyFormat = (currency: string) =>
  new Intl.NumberFormat('en-US', {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  })

const availableMetric = (
  metricKey: MetricValueDto['metricKey'],
  rawValue: number,
  displayValue: string,
  unit: MetricValueDto['unit'],
): MetricValueDto => ({
  _tag: 'MetricAvailable',
  metricKey,
  rawValue,
  displayValue,
  unit,
  warnings: [],
})

const maybeDate = (date: string | null): ConversionViewModelDto['result']['effectiveDate'] =>
  matchBoolean<ConversionViewModelDto['result']['effectiveDate']>({
    false: () => ({ _tag: 'Nothing' }),
    true: () => ({ _tag: 'Just', value: String(date) }),
  })(date !== null)

const rateDerivation = (result: ConversionResult): RateDerivationDto =>
  ((derivations: Readonly<Record<ConversionResult['mode'], RateDerivationDto>>) => derivations)({
    provider: {
      _tag: 'DirectRate',
      requestedPair: `${result.base}/${result.quote}`,
      sourcePair: result.sourcePair,
      displayedPair: `${result.base}/${result.quote}`,
    },
    'same-currency': {
      _tag: 'SameCurrencyRate',
      requestedPair: `${result.base}/${result.quote}`,
      sourcePair: result.sourcePair,
      displayedPair: `${result.base}/${result.quote}`,
      formulaKey: 'same-currency-rate',
      displayNote: 'Same-currency conversion is always 1:1.',
    },
  })[result.mode]

const insight = (result: ConversionResult): string =>
  ({
    provider: `Latest available reference rate: 1 ${result.base} = ${numberFormat.format(result.rate)} ${result.quote}.`,
    'same-currency': 'Same-currency conversion is 1:1.',
  })[result.mode]

export const toConversionViewModel = (result: ConversionResult): ConversionViewModelDto => ({
  mode: 'conversion',
  amount: {
    rawAmount: result.amount,
    displayAmount: moneyFormat(result.base).format(result.amount),
    currency: result.base,
  },
  base: toCurrencySummary(result.base),
  quote: toCurrencySummary(result.quote),
  result: {
    convertedAmount: availableMetric(
      'converted-amount',
      result.convertedAmount,
      moneyFormat(result.quote).format(result.convertedAmount),
      'currency',
    ),
    rate: availableMetric(
      'latest-reference-rate',
      result.rate,
      numberFormat.format(result.rate),
      'rate',
    ),
    effectiveDate: maybeDate(result.effectiveDate),
    rateDerivation: rateDerivation(result),
  },
  insight: insight(result),
  actions: {
    analysePair: {
      href: `/analyse?base=${result.base}&quote=${result.quote}`,
      base: result.base,
      quote: result.quote,
    },
    compareBase: {
      href: `/compare?base=${result.base}&quote=${result.quote}`,
      base: result.base,
      quote: result.quote,
    },
  },
  attribution,
  aiContextSeed: {
    mode: 'conversion',
    selectedCurrencies: {
      base: result.base,
      quotes: [result.quote],
    },
    selectedDateRange: { _tag: 'Nothing' },
    keyResults: [
      {
        key: 'convertedAmount',
        label: 'Converted amount',
        value: moneyFormat(result.quote).format(result.convertedAmount),
      },
      {
        key: 'latestReferenceRate',
        label: 'Latest reference rate',
        value: numberFormat.format(result.rate),
      },
    ],
    computedStats: { _tag: 'Nothing' },
    chartSummary: { _tag: 'Nothing' },
    formulaSummaries: [],
    appDisclaimers: ['Reference rates may differ from live market, bank, card or payment-service rates.'],
  },
})
