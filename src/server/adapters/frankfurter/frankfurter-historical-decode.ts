import type { CurrencyCode } from '@/server/domain/currency/currency'
import {
  decodeIsoDateString,
  decodeRecord,
  decodeString,
  readField,
} from '@/server/http/request-validation'
import type {
  HistoricalRateData,
  HistoricalRateInput,
  HistoricalRateObservation,
  ProviderError,
} from '@/server/ports/rate-provider'
import {
  chainResult,
  failure,
  liftResult2,
  mapFailure,
  mapResult,
  success,
  traverseResult,
  type Result,
} from '@/shared/fp'
import { frankfurterInvalidPayloadError } from './frankfurter-errors'

type DecodedHistoricalRateRow = {
  readonly date: string
  readonly base: string
  readonly quote: string
  readonly rate: number | null
}

const toInvalidPayload = (label: string): ProviderError =>
  frankfurterInvalidPayloadError(`Frankfurter historical-rate payload did not contain ${label}.`)

const providerDecode =
  <A>(label: string) =>
  (result: Result<unknown, A>): Result<ProviderError, A> =>
    mapFailure(() => toInvalidPayload(label))(result)

const booleanResult = <A>(
  predicate: boolean,
  error: ProviderError,
  value: A,
): Result<ProviderError, A> =>
  ({
    false: failure(error),
    true: success(value),
  })[String(predicate) as 'false' | 'true']

const decodeNullableFiniteNumber =
  (path: readonly string[]) =>
  (value: unknown): Result<ProviderError, number | null> =>
    booleanResult(
      value === null || (typeof value === 'number' && Number.isFinite(value)),
      toInvalidPayload(path.join('.') || 'a nullable finite rate'),
      value as number | null,
    )

const keepExpectedBase =
  (input: HistoricalRateInput) =>
  (base: string): Result<ProviderError, CurrencyCode> =>
    booleanResult(
      base === input.base,
      toInvalidPayload(`base ${input.base}`),
      input.base,
    )

const keepExpectedQuote =
  (input: HistoricalRateInput) =>
  (quote: string): Result<ProviderError, CurrencyCode> =>
    booleanResult(
      quote === input.quote,
      toInvalidPayload(`quote ${input.quote}`),
      input.quote,
    )

const decodedHistoricalRateRow = (
  date: string,
  base: string,
  quote: string,
  rate: number | null,
): DecodedHistoricalRateRow => ({
  date,
  base,
  quote,
  rate,
})

const decodeRowFields = (
  record: Readonly<Record<string, unknown>>,
): Result<ProviderError, DecodedHistoricalRateRow> =>
  chainResult<ProviderError, string, DecodedHistoricalRateRow>((date) =>
    chainResult<ProviderError, string, DecodedHistoricalRateRow>((base) =>
      chainResult<ProviderError, string, DecodedHistoricalRateRow>((quote) =>
        mapResult<number | null, DecodedHistoricalRateRow>((rate) =>
          decodedHistoricalRateRow(date, base, quote, rate),
        )(
          decodeNullableFiniteNumber(['rate'])(readField('rate')(record)),
        ),
      )(
        providerDecode<string>('quote')(
          decodeString(['quote'])(readField('quote')(record)),
        ),
      ),
    )(
      providerDecode<string>('base')(
        decodeString(['base'])(readField('base')(record)),
      ),
    ),
  )(
    providerDecode<string>('date')(
      decodeIsoDateString(['date'])(readField('date')(record)),
    ),
  )

const decodeRow = (item: unknown): Result<ProviderError, DecodedHistoricalRateRow> =>
  chainResult<ProviderError, Readonly<Record<string, unknown>>, DecodedHistoricalRateRow>(
    decodeRowFields,
  )(
    providerDecode<Readonly<Record<string, unknown>>>('historical rate row')(
      decodeRecord([])(item),
    ),
  )

const decodeUnknownArray = (payload: unknown): Result<ProviderError, ReadonlyArray<unknown>> =>
  booleanResult(
    Array.isArray(payload),
    toInvalidPayload('historical rate array'),
    payload as ReadonlyArray<unknown>,
  )

const decodeRows = (payload: unknown): Result<ProviderError, ReadonlyArray<DecodedHistoricalRateRow>> =>
  chainResult<ProviderError, ReadonlyArray<unknown>, ReadonlyArray<DecodedHistoricalRateRow>>((items) =>
    traverseResult<ProviderError, unknown, DecodedHistoricalRateRow>(decodeRow)(items),
  )(decodeUnknownArray(payload))

const keepExpectedPair =
  (input: HistoricalRateInput) =>
  (row: DecodedHistoricalRateRow): Result<ProviderError, DecodedHistoricalRateRow> =>
    mapResult(() => row)(
      liftResult2((base: CurrencyCode, quote: CurrencyCode) => `${base}/${quote}`)(
        keepExpectedBase(input)(row.base),
        keepExpectedQuote(input)(row.quote),
      ),
    )

const toObservation = (row: DecodedHistoricalRateRow): HistoricalRateObservation => ({
  date: row.date,
  rate: row.rate,
})

const toHistoricalRateData =
  (input: HistoricalRateInput) =>
  (rows: ReadonlyArray<DecodedHistoricalRateRow>): HistoricalRateData => ({
    base: input.base,
    quote: input.quote,
    startDate: input.startDate,
    endDate: input.endDate,
    observations: rows.map(toObservation),
    sourcePair: `${input.base}/${input.quote}`,
  })

export const decodeFrankfurterHistoricalRates =
  (input: HistoricalRateInput) =>
  (payload: unknown): Result<ProviderError, HistoricalRateData> =>
    chainResult<ProviderError, ReadonlyArray<DecodedHistoricalRateRow>, HistoricalRateData>((rows) =>
      mapResult(toHistoricalRateData(input))(
        traverseResult<ProviderError, DecodedHistoricalRateRow, DecodedHistoricalRateRow>(
          keepExpectedPair(input),
        )(rows),
      ),
    )(decodeRows(payload))
