import { createFrankfurterExchangeRateProvider } from '@/server/adapters/frankfurter/frankfurter-adapter'
import { staticSafeCurrencyCatalogue } from '@/server/domain/currency/currency'
import type { ExchangeRateProvider, ProviderCurrencyCatalogueResult } from '@/server/ports/rate-provider'
import type { AttributionDto, CurrencyDto } from '@/shared/dto/api'
import type { CurrenciesResponseDto } from '@/shared/dto/currencies'
import {
  fromNullable,
  matchMaybe,
  matchResult,
  none,
  some,
  success,
  type AsyncResult,
  type Maybe,
} from '@/shared/fp'

export type CurrencyCatalogueServiceError = never

export type CachedCurrencyCatalogue = {
  readonly retrievedAt: string
  readonly currencies: ProviderCurrencyCatalogueResult['currencies']
}

export type CurrencyCatalogueCache = {
  readonly read: () => Maybe<CachedCurrencyCatalogue>
  readonly write: (catalogue: CachedCurrencyCatalogue) => void
}

export type CurrencyCatalogueDeps = {
  readonly provider: ExchangeRateProvider
  readonly cache: CurrencyCatalogueCache
}

const attribution: AttributionDto = {
  label: 'Exchange-rate reference data by Frankfurter',
  sourceName: 'Frankfurter API',
  sourceUrl: 'https://frankfurter.dev',
}

const symbolFor = (code: string): CurrencyDto['symbol'] =>
  matchMaybe<typeof staticSafeCurrencyCatalogue.currencies[number], CurrencyDto['symbol']>({
    none: () => ({ _tag: 'Nothing' }),
    some: (currency) => ({ _tag: 'Just', value: currency.symbol }),
  })(
    fromNullable(staticSafeCurrencyCatalogue.currencies.find((currency) => currency.code === code)),
  )

const currencyDto = (currency: ProviderCurrencyCatalogueResult['currencies'][number]): CurrencyDto => ({
  code: currency.code,
  name: currency.name,
  symbol: symbolFor(currency.code),
})

const staticCurrencyDto = (
  currency: typeof staticSafeCurrencyCatalogue.currencies[number],
): CurrencyDto => ({
  code: currency.code,
  name: currency.name,
  symbol: { _tag: 'Just', value: currency.symbol },
})

const responseFromProvider = (catalogue: ProviderCurrencyCatalogueResult): CurrenciesResponseDto => ({
  catalogue: {
    source: 'provider',
    retrievedAt: { _tag: 'Just', value: catalogue.retrievedAt },
    currencies: catalogue.currencies.map(currencyDto),
  },
  attribution,
})

const responseFromStaleCache = (catalogue: CachedCurrencyCatalogue): CurrenciesResponseDto => ({
  catalogue: {
    source: 'stale-cache',
    retrievedAt: { _tag: 'Just', value: catalogue.retrievedAt },
    currencies: catalogue.currencies.map(currencyDto),
  },
  attribution,
})

const responseFromStaticSafeList = (): CurrenciesResponseDto => ({
  catalogue: {
    source: 'static-safe-list',
    retrievedAt: { _tag: 'Nothing' },
    currencies: staticSafeCurrencyCatalogue.currencies.map(staticCurrencyDto),
  },
  attribution,
})

const cachedCatalogue = (catalogue: ProviderCurrencyCatalogueResult): CachedCurrencyCatalogue => ({
  retrievedAt: catalogue.retrievedAt,
  currencies: catalogue.currencies,
})

const writeProviderCatalogue =
  (cache: CurrencyCatalogueCache) =>
  (catalogue: ProviderCurrencyCatalogueResult): ProviderCurrencyCatalogueResult => {
    cache.write(cachedCatalogue(catalogue))

    return catalogue
  }

const fallbackResponse = (cache: CurrencyCatalogueCache): CurrenciesResponseDto =>
  matchMaybe<CachedCurrencyCatalogue, CurrenciesResponseDto>({
    none: responseFromStaticSafeList,
    some: responseFromStaleCache,
  })(cache.read())

export const createInMemoryCurrencyCatalogueCache = (): CurrencyCatalogueCache => {
  let cached: Maybe<CachedCurrencyCatalogue> = none()

  return {
    read: () => cached,
    write: (catalogue) => {
      cached = some(catalogue)
    },
  }
}

export const defaultCurrencyCatalogueCache = createInMemoryCurrencyCatalogueCache()

export const defaultCurrencyCatalogueDeps: CurrencyCatalogueDeps = {
  provider: createFrankfurterExchangeRateProvider(),
  cache: defaultCurrencyCatalogueCache,
}

// getCurrencyCatalogue :: Deps -> AsyncResult<never, CurrenciesResponseDto>
export const getCurrencyCatalogue =
  (deps: CurrencyCatalogueDeps = defaultCurrencyCatalogueDeps): AsyncResult<CurrencyCatalogueServiceError, CurrenciesResponseDto> =>
    deps.provider.getCurrencyCatalogue()
      .then(
        matchResult({
          failure: () => success(fallbackResponse(deps.cache)),
          success: (catalogue) => success(responseFromProvider(writeProviderCatalogue(deps.cache)(catalogue))),
        }),
      )
      .catch(() => success(fallbackResponse(deps.cache)))
