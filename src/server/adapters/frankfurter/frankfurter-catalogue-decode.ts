import { parseCurrencyCode, staticSafeCurrencyCatalogue } from '@/server/domain/currency/currency'
import { decodeRecord, decodeString } from '@/server/http/request-validation'
import type { ProviderCurrencyCatalogueResult, ProviderError } from '@/server/ports/rate-provider'
import {
  chainResult,
  foldMaybe,
  fromNullable,
  mapResult,
  matchMaybe,
  mapFailure,
  sequenceResult,
  type Result,
} from '@/shared/fp'
import { frankfurterInvalidPayloadError } from './frankfurter-errors'

type ProviderCurrencyEntry = ProviderCurrencyCatalogueResult['currencies'][number]

const toInvalidPayload = (): ProviderError =>
  frankfurterInvalidPayloadError('Frankfurter currency catalogue payload was not a code-to-name object.')

const providerDecode =
  <A>(result: Result<unknown, A>): Result<ProviderError, A> =>
    mapFailure(toInvalidPayload)(result)

const staticCurrencyName = (code: ProviderCurrencyEntry['code']): string =>
  matchMaybe<ProviderCurrencyEntry, string>({
    none: () => code,
    some: (currency) => currency.name,
  })(
    fromNullable(staticSafeCurrencyCatalogue.currencies.find((currency) => currency.code === code)),
  )

const providerCurrencyEntry =
  (record: Readonly<Record<string, unknown>>) =>
  (candidate: string): Result<ProviderError, ProviderCurrencyEntry> =>
    chainResult<ProviderError, ProviderCurrencyEntry['code'], ProviderCurrencyEntry>((code) =>
      mapResult<string, ProviderCurrencyEntry>((name) => ({
        code,
        name,
      }))(
        providerDecode(decodeString([code])(foldMaybe(staticCurrencyName(code), (v: unknown) => v)(fromNullable(record[code])))),
      ),
    )(
      mapFailure(toInvalidPayload)(
        parseCurrencyCode(staticSafeCurrencyCatalogue)(candidate),
      ),
    )

const decodeSupportedEntries = (
  record: Readonly<Record<string, unknown>>,
): Result<ProviderError, ReadonlyArray<ProviderCurrencyEntry>> =>
  sequenceResult(staticSafeCurrencyCatalogue.currencies.map((currency) =>
    providerCurrencyEntry(record)(currency.code),
  ))

const catalogueResult =
  (retrievedAt: string) =>
  (currencies: ReadonlyArray<ProviderCurrencyEntry>): ProviderCurrencyCatalogueResult => ({
    source: 'provider',
    retrievedAt,
    currencies,
  })

export const decodeFrankfurterCurrencyCatalogue =
  (retrievedAt: string) =>
  (payload: unknown): Result<ProviderError, ProviderCurrencyCatalogueResult> =>
    chainResult<ProviderError, Readonly<Record<string, unknown>>, ProviderCurrencyCatalogueResult>((record) =>
      mapResult(catalogueResult(retrievedAt))(decodeSupportedEntries(record)),
    )(
      providerDecode(decodeRecord([])(payload)),
    )
