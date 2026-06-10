import { compare, type ComparisonError } from '@/server/application/comparison/compare'
import { createRequestId, toJsonResponse } from '@/server/http/api-envelope'
import {
  decodeCurrencyCodeCandidate,
  decodeIsoDateString,
  decodeReadonlyArray,
  decodeRecord,
  decodeString,
  readField,
} from '@/server/http/request-validation'
import type { ExchangeRateProvider } from '@/server/ports/rate-provider'
import { currentIsoDate } from '@/shared/date'
import type { AnalyseDateRangeRequestDto } from '@/shared/dto/analysis'
import type { ApiErrorCodeDto, ApiErrorDto, FieldErrorDto } from '@/shared/dto/api'
import type { CompareRequestDto, ComparisonViewModelDto } from '@/shared/dto/comparison'
import {
  chainResult,
  failure,
  fromNullable,
  liftResult2,
  liftResult3,
  mapFailure,
  mapResult,
  matchMaybe,
  matchResult,
  matchTag,
  success,
  type AsyncResult,
  type Result,
} from '@/shared/fp'

type DateRangeTag = AnalyseDateRangeRequestDto['_tag']
type DateRangePresetDto = Extract<AnalyseDateRangeRequestDto, { readonly _tag: 'Preset' }>['preset']
type TaggedDateRangeRecord = {
  readonly record: Readonly<Record<string, unknown>>
  readonly tag: DateRangeTag
}

const dateRangeTags: ReadonlyArray<DateRangeTag> = ['Preset', 'Custom']
const dateRangePresets: ReadonlyArray<DateRangePresetDto> = ['7D', '30D', '90D', '1Y']

const invalidJson: ComparisonError = {
  tag: 'invalid-json',
  message: 'Request body must be valid JSON.',
}

const invalidShape = (field: string, message: string): ComparisonError => ({
  tag: 'invalid-request-shape',
  field,
  message,
})

const invalidCurrencyCode = (field: 'base' | 'quotes'): ComparisonError => ({
  tag: 'invalid-request-shape',
  field,
  message: `${field} must contain 3-letter currency codes.`,
})

const readJsonBody = async (request: Request): AsyncResult<ComparisonError, unknown> => {
  try {
    return success(await request.json())
  } catch {
    return failure(invalidJson)
  }
}

const decodeRequestRecord = (payload: unknown): Result<ComparisonError, Readonly<Record<string, unknown>>> =>
  mapFailure(() => invalidShape('body', 'Request body must be an object.'))(
    decodeRecord([])(payload),
  )

const decodeBaseField = (record: Readonly<Record<string, unknown>>): Result<ComparisonError, string> =>
  mapFailure(() => invalidCurrencyCode('base'))(
    decodeCurrencyCodeCandidate(['base'])(readField('base')(record)),
  )

const decodeQuotesField = (record: Readonly<Record<string, unknown>>): Result<ComparisonError, ReadonlyArray<string>> =>
  mapFailure(() => invalidCurrencyCode('quotes'))(
    decodeReadonlyArray(['quotes'], decodeCurrencyCodeCandidate(['quotes']))(readField('quotes')(record)),
  )

const dateRangeShapeError = (message: string): ComparisonError =>
  invalidShape('dateRange', message)

const decodeDateRangeRecord = (
  record: Readonly<Record<string, unknown>>,
): Result<ComparisonError, Readonly<Record<string, unknown>>> =>
  mapFailure(() => dateRangeShapeError('dateRange must be an object.'))(
    decodeRecord(['dateRange'])(readField('dateRange')(record)),
  )

const decodeAllowedString =
  <A extends string>(allowedValues: ReadonlyArray<A>, message: string) =>
  (value: string): Result<ComparisonError, A> =>
    matchMaybe<A, Result<ComparisonError, A>>({
      none: () => failure(dateRangeShapeError(message)),
      some: success,
    })(fromNullable(allowedValues.find((candidate) => candidate === value)))

const decodeDateRangeTag = (
  record: Readonly<Record<string, unknown>>,
): Result<ComparisonError, DateRangeTag> =>
  chainResult<ComparisonError, string, DateRangeTag>(
    decodeAllowedString(dateRangeTags, 'dateRange._tag must be Preset or Custom.'),
  )(
    mapFailure(() => dateRangeShapeError('dateRange._tag must be Preset or Custom.'))(
      decodeString(['dateRange', '_tag'])(readField('_tag')(record)),
    ),
  )

const presetDto = (preset: DateRangePresetDto): AnalyseDateRangeRequestDto => ({
  _tag: 'Preset',
  preset,
})

const decodePreset = (
  record: Readonly<Record<string, unknown>>,
): Result<ComparisonError, AnalyseDateRangeRequestDto> =>
  mapResult(presetDto)(
    chainResult<ComparisonError, string, DateRangePresetDto>(
      decodeAllowedString(dateRangePresets, 'dateRange.preset must be 7D, 30D, 90D or 1Y.'),
    )(
    mapFailure(() => dateRangeShapeError('dateRange.preset must be 7D, 30D, 90D or 1Y.'))(
      decodeString(['dateRange', 'preset'])(readField('preset')(record)),
    ),
    ),
  )

const customDateRangeDto = (
  startDate: string,
  endDate: string,
): AnalyseDateRangeRequestDto => ({
  _tag: 'Custom',
  startDate,
  endDate,
})

const decodeCustom = (
  record: Readonly<Record<string, unknown>>,
): Result<ComparisonError, AnalyseDateRangeRequestDto> =>
  liftResult2(customDateRangeDto)(
    mapFailure(() => invalidShape('startDate', 'startDate must be a real ISO date in YYYY-MM-DD format.'))(
      decodeIsoDateString(['dateRange', 'startDate'])(readField('startDate')(record)),
    ),
    mapFailure(() => invalidShape('endDate', 'endDate must be a real ISO date in YYYY-MM-DD format.'))(
      decodeIsoDateString(['dateRange', 'endDate'])(readField('endDate')(record)),
    ),
  )

const dateRangeDecoder = (
  tag: DateRangeTag,
): (record: Readonly<Record<string, unknown>>) => Result<ComparisonError, AnalyseDateRangeRequestDto> =>
  ({
    Custom: decodeCustom,
    Preset: decodePreset,
  })[tag]

const decodeDateRangeByTag =
  (record: Readonly<Record<string, unknown>>) =>
  (tag: DateRangeTag): Result<ComparisonError, AnalyseDateRangeRequestDto> =>
    dateRangeDecoder(tag)(record)

const taggedDateRangeRecord = (
  record: Readonly<Record<string, unknown>>,
): Result<ComparisonError, TaggedDateRangeRecord> =>
  mapResult((tag: DateRangeTag) => ({ record, tag }))(decodeDateRangeTag(record))

const decodeTaggedDateRangeRecord = (
  taggedRecord: TaggedDateRangeRecord,
): Result<ComparisonError, AnalyseDateRangeRequestDto> =>
  decodeDateRangeByTag(taggedRecord.record)(taggedRecord.tag)

const decodeDateRange = (
  record: Readonly<Record<string, unknown>>,
): Result<ComparisonError, AnalyseDateRangeRequestDto> => {
  const dateRangeRecord = decodeDateRangeRecord(record)
  const taggedRecord = chainResult<ComparisonError, Readonly<Record<string, unknown>>, TaggedDateRangeRecord>(
    taggedDateRangeRecord,
  )(dateRangeRecord)

  return chainResult<ComparisonError, TaggedDateRangeRecord, AnalyseDateRangeRequestDto>(
    decodeTaggedDateRangeRecord,
  )(taggedRecord)
}

const compareRequestDto = (
  base: string,
  quotes: ReadonlyArray<string>,
  dateRange: AnalyseDateRangeRequestDto,
): CompareRequestDto => ({
  base,
  quotes,
  dateRange,
})

const decodeRecordFields = (record: Readonly<Record<string, unknown>>): Result<ComparisonError, CompareRequestDto> =>
  liftResult3(compareRequestDto)(
    decodeBaseField(record),
    decodeQuotesField(record),
    decodeDateRange(record),
  )

const decodeCompareRequest = (payload: unknown): Result<ComparisonError, CompareRequestDto> =>
  chainResult<ComparisonError, Readonly<Record<string, unknown>>, CompareRequestDto>(decodeRecordFields)(
    decodeRequestRecord(payload),
  )

const decodeRequestBody = async (request: Request): AsyncResult<ComparisonError, CompareRequestDto> =>
  Promise.resolve(
    chainResult<ComparisonError, unknown, CompareRequestDto>(decodeCompareRequest)(await readJsonBody(request)),
  )

const apiError = (
  code: ApiErrorCodeDto,
  category: ApiErrorDto['category'],
  message: string,
  fieldErrors: ApiErrorDto['fieldErrors'],
  details: ApiErrorDto['details'] = [],
): ApiErrorDto => ({
  code,
  category,
  message,
  recoverable: true,
  fieldErrors,
  details,
})

type DateRangeComparisonError = Extract<ComparisonError, { readonly tag: 'date-range-error' }>
type DuplicateQuoteError = Extract<ComparisonError, { readonly tag: 'duplicate-quote-currency' }>
type InvalidRequestShapeError = Extract<ComparisonError, { readonly tag: 'invalid-request-shape' }>
type NoQuotesSelectedError = Extract<ComparisonError, { readonly tag: 'no-quotes-selected' }>
type QuoteLimitExceededError = Extract<ComparisonError, { readonly tag: 'quote-limit-exceeded' }>
type UnsupportedCurrencyError = Extract<ComparisonError, { readonly tag: 'unsupported-currency' }>

const dateRangeErrorApiCode: Readonly<Record<DateRangeComparisonError['error']['tag'], ApiErrorCodeDto>> = {
  'future-date': 'FUTURE_DATE_NOT_ALLOWED',
  'invalid-date': 'INVALID_DATE_RANGE',
  'invalid-date-range': 'INVALID_DATE_RANGE',
  'unsupported-preset': 'INVALID_DATE_RANGE',
}

const fieldError = (
  field: string,
  code: string,
  message: string,
): FieldErrorDto => ({
  field,
  code,
  message,
})

const dateRangeFieldError = (error: DateRangeComparisonError): FieldErrorDto =>
  fieldError(error.error.field, dateRangeErrorApiCode[error.error.tag], error.error.message)

const quoteFieldError = (
  code: string,
  message: string,
): FieldErrorDto =>
  fieldError('quotes', code, message)

const mapDateRangeError = (error: DateRangeComparisonError): ApiErrorDto =>
  apiError(
    dateRangeErrorApiCode[error.error.tag],
    'date-range',
    error.error.message,
    [dateRangeFieldError(error)],
  )

const mapDuplicateQuoteError = (error: DuplicateQuoteError): ApiErrorDto =>
  apiError('DUPLICATE_QUOTE_CURRENCY', 'validation', error.message, [
    quoteFieldError('DUPLICATE_QUOTE_CURRENCY', error.message),
  ])

const mapInvalidJsonError = (error: Extract<ComparisonError, { readonly tag: 'invalid-json' }>): ApiErrorDto =>
  apiError('INVALID_JSON', 'validation', error.message, [])

const mapInvalidShapeError = (error: InvalidRequestShapeError): ApiErrorDto =>
  apiError('INVALID_REQUEST_SHAPE', 'validation', error.message, [
    fieldError(error.field, 'INVALID_REQUEST_SHAPE', error.message),
  ])

const mapNoQuotesError = (error: NoQuotesSelectedError): ApiErrorDto =>
  apiError('NO_QUOTES_SELECTED', 'validation', error.message, [
    quoteFieldError('NO_QUOTES_SELECTED', error.message),
  ])

const mapProviderPayloadError = (
  error: Extract<ComparisonError, { readonly tag: 'provider-payload-invalid' }>,
): ApiErrorDto =>
  apiError('PROVIDER_PAYLOAD_INVALID', 'provider', error.message, [])

const mapProviderUnavailableError = (
  error: Extract<ComparisonError, { readonly tag: 'provider-unavailable' }>,
): ApiErrorDto =>
  apiError('PROVIDER_UNAVAILABLE', 'provider', error.message, [])

const mapQuoteLimitError = (error: QuoteLimitExceededError): ApiErrorDto =>
  apiError(
    'QUOTE_LIMIT_EXCEEDED',
    'validation',
    error.message,
    [quoteFieldError('max_10_quotes', 'Select 10 or fewer quote currencies.')],
    [{ key: 'limit', value: error.limit.toString() }],
  )

const mapRateDerivationError = (
  error: Extract<ComparisonError, { readonly tag: 'rate-derivation-unavailable' }>,
): ApiErrorDto =>
  apiError('CALCULATION_UNAVAILABLE', 'calculation', error.message, [])

const mapUnsupportedCurrencyError = (error: UnsupportedCurrencyError): ApiErrorDto =>
  apiError('UNSUPPORTED_CURRENCY', 'currency', error.message, [
    fieldError(error.field, 'UNSUPPORTED_CURRENCY', error.message),
  ])

const mapComparisonErrorToApiError = (error: ComparisonError): ApiErrorDto =>
  matchTag<ComparisonError, ApiErrorDto>({
    'date-range-error': mapDateRangeError,
    'duplicate-quote-currency': mapDuplicateQuoteError,
    'invalid-json': mapInvalidJsonError,
    'invalid-request-shape': mapInvalidShapeError,
    'no-quotes-selected': mapNoQuotesError,
    'provider-payload-invalid': mapProviderPayloadError,
    'provider-unavailable': mapProviderUnavailableError,
    'quote-limit-exceeded': mapQuoteLimitError,
    'rate-derivation-unavailable': mapRateDerivationError,
    'unsupported-currency': mapUnsupportedCurrencyError,
  })(error)

const runComparison =
  (exchangeRateProvider: ExchangeRateProvider) =>
  (input: CompareRequestDto): AsyncResult<ComparisonError, ComparisonViewModelDto> =>
    compare({ exchangeRateProvider, today: currentIsoDate() })(input)

export const createComparePostHandler =
  (exchangeRateProvider: ExchangeRateProvider) =>
  async (request: Request): Promise<Response> => {
    const requestId = createRequestId()
    const decodedInput = await decodeRequestBody(request)
    const result = await matchResult<ComparisonError, CompareRequestDto, AsyncResult<ComparisonError, ComparisonViewModelDto>>({
      failure: (error) => Promise.resolve(failure(error)),
      success: runComparison(exchangeRateProvider),
    })(decodedInput)

    return toJsonResponse(requestId, mapComparisonErrorToApiError)(result)
  }
