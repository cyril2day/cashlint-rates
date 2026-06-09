import type { CurrencyCode } from '@/server/domain/currency/currency'
import {
  decodeFiniteNumber,
  decodeIsoDateString,
  decodeRecord,
  decodeString,
  readField,
} from '@/server/http/request-validation'
import type { LatestRateData, LatestRateInput, ProviderError } from '@/server/ports/rate-provider'
import {
  booleanKey,
  failure,
  liftResult2,
  liftResult3,
  mapFailure,
  matchResult,
  success,
  type Result,
} from '@/shared/fp'
import { frankfurterInvalidPayloadError } from './frankfurter-errors'

type DecodedLatestEnvelope = {
  readonly base: string
  readonly date: string
  readonly rates: Readonly<Record<string, unknown>>
}

const toInvalidPayload = (label: string): ProviderError =>
  frankfurterInvalidPayloadError(`Frankfurter latest-rate payload did not contain ${label}.`)

const providerDecode =
  <A>(label: string) =>
  (result: Result<unknown, A>): Result<ProviderError, A> =>
    mapFailure(() => toInvalidPayload(label))(result)

const keepExpectedBase =
  (input: LatestRateInput) =>
  (base: string): Result<ProviderError, CurrencyCode> =>
    ({
      false: failure(toInvalidPayload(`base ${input.base}`)),
      true: success(input.base),
    })[booleanKey(base === input.base)]

const keepPositiveRate = (rate: number): Result<ProviderError, number> =>
    ({
      false: failure(toInvalidPayload('a positive finite quote rate')),
      true: success(rate),
  })[booleanKey(rate > 0)]

const latestEnvelope = (
  base: string,
  date: string,
  rates: Readonly<Record<string, unknown>>,
): DecodedLatestEnvelope => ({
  base,
  date,
  rates,
})

const decodeEnvelopeFields = (record: Readonly<Record<string, unknown>>): Result<ProviderError, DecodedLatestEnvelope> =>
  liftResult3(latestEnvelope)(
    providerDecode<string>('base')(
      decodeString(['base'])(readField('base')(record)),
    ),
    providerDecode<string>('date')(
      decodeIsoDateString(['date'])(readField('date')(record)),
    ),
    providerDecode<Readonly<Record<string, unknown>>>('rates object')(
      decodeRecord(['rates'])(readField('rates')(record)),
    ),
  )

const decodeEnvelope = (payload: unknown): Result<ProviderError, DecodedLatestEnvelope> =>
  matchResult<ProviderError, Readonly<Record<string, unknown>>, Result<ProviderError, DecodedLatestEnvelope>>({
    failure: (error) => failure(error),
    success: decodeEnvelopeFields,
  })(
    providerDecode<Readonly<Record<string, unknown>>>('response object')(
      decodeRecord([])(payload),
    ),
  )

const decodePositiveQuoteRate = (
  input: LatestRateInput,
  envelope: DecodedLatestEnvelope,
): Result<ProviderError, number> =>
  matchResult<ProviderError, number, Result<ProviderError, number>>({
    failure: (error) => failure(error),
    success: keepPositiveRate,
  })(
    providerDecode<number>(`rate for ${input.quote}`)(
      decodeFiniteNumber(['rates', input.quote])(envelope.rates[input.quote]),
    ),
  )

const latestRateData =
  (input: LatestRateInput, envelope: DecodedLatestEnvelope) =>
  (base: CurrencyCode, rate: number): LatestRateData => ({
    base,
    quote: input.quote,
    rate,
    effectiveDate: envelope.date,
    sourcePair: `${base}/${input.quote}`,
  })

const decodeLatestRateData =
  (input: LatestRateInput) =>
  (envelope: DecodedLatestEnvelope): Result<ProviderError, LatestRateData> =>
    liftResult2(latestRateData(input, envelope))(
      keepExpectedBase(input)(envelope.base),
      decodePositiveQuoteRate(input, envelope),
    )

export const decodeFrankfurterLatestRate =
  (input: LatestRateInput) =>
  (payload: unknown): Result<ProviderError, LatestRateData> =>
    matchResult<ProviderError, DecodedLatestEnvelope, Result<ProviderError, LatestRateData>>({
      failure: (error) => failure(error),
      success: decodeLatestRateData(input),
    })(decodeEnvelope(payload))
