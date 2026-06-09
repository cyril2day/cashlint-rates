import { analyse, type AnalysisError } from '@/server/application/analysis/analyse'
import { createRequestId, toJsonResponse } from '@/server/http/api-envelope'
import {
  decodeCurrencyCodeCandidate,
  decodeIsoDateString,
  decodeRecord,
  decodeString,
  readField,
} from '@/server/http/request-validation'
import type { ExchangeRateProvider } from '@/server/ports/rate-provider'
import { currentIsoDate } from '@/shared/date'
import type {
  AnalyseDateRangeRequestDto,
  AnalyseRequestDto,
  PairAnalysisViewModelDto,
} from '@/shared/dto/analysis'
import type { ApiErrorCodeDto, ApiErrorDto } from '@/shared/dto/api'
import {
  failure,
  fromNullable,
  liftResult2,
  liftResult3,
  mapFailure,
  matchMaybe,
  matchResult,
  matchTag,
  success,
  type AsyncResult,
  type Result,
} from '@/shared/fp'

type DateRangeTag = AnalyseDateRangeRequestDto['_tag']
type DateRangePresetDto = Extract<AnalyseDateRangeRequestDto, { readonly _tag: 'Preset' }>['preset']

const dateRangeTags: ReadonlyArray<DateRangeTag> = ['Preset', 'Custom']
const dateRangePresets: ReadonlyArray<DateRangePresetDto> = ['7D', '30D', '90D', '1Y']

const invalidJson: AnalysisError = {
  tag: 'invalid-json',
  message: 'Request body must be valid JSON.',
}

const invalidShape = (field: string, message: string): AnalysisError => ({
  tag: 'invalid-request-shape',
  field,
  message,
})

const invalidCurrencyCode = (field: 'base' | 'quote'): AnalysisError => ({
  tag: 'invalid-request-shape',
  field,
  message: `${field} must be a 3-letter currency code.`,
})

const readJsonBody = async (request: Request): AsyncResult<AnalysisError, unknown> => {
  try {
    return success(await request.json())
  } catch {
    return failure(invalidJson)
  }
}

const decodeRequestRecord = (payload: unknown): Result<AnalysisError, Readonly<Record<string, unknown>>> =>
  mapFailure(() => invalidShape('body', 'Request body must be an object.'))(
    decodeRecord([])(payload),
  )

const decodeCurrencyField =
  (field: 'base' | 'quote') =>
  (record: Readonly<Record<string, unknown>>): Result<AnalysisError, string> =>
    mapFailure(() => invalidCurrencyCode(field))(
      decodeCurrencyCodeCandidate([field])(readField(field)(record)),
    )

const dateRangeShapeError = (message: string): AnalysisError =>
  invalidShape('dateRange', message)

const decodeDateRangeRecord = (
  record: Readonly<Record<string, unknown>>,
): Result<AnalysisError, Readonly<Record<string, unknown>>> =>
  mapFailure(() => dateRangeShapeError('dateRange must be an object.'))(
    decodeRecord(['dateRange'])(readField('dateRange')(record)),
  )

const decodeAllowedString =
  <A extends string>(allowedValues: ReadonlyArray<A>, message: string) =>
  (value: string): Result<AnalysisError, A> =>
    matchMaybe<A, Result<AnalysisError, A>>({
      none: () => failure(dateRangeShapeError(message)),
      some: success,
    })(fromNullable(allowedValues.find((candidate) => candidate === value)))

const decodeDateRangeTag = (
  record: Readonly<Record<string, unknown>>,
): Result<AnalysisError, DateRangeTag> =>
  matchResult<AnalysisError, string, Result<AnalysisError, DateRangeTag>>({
    failure,
    success: decodeAllowedString(dateRangeTags, 'dateRange._tag must be Preset or Custom.'),
  })(
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
): Result<AnalysisError, AnalyseDateRangeRequestDto> =>
  matchResult<AnalysisError, string, Result<AnalysisError, AnalyseDateRangeRequestDto>>({
    failure,
    success: (preset) =>
      matchResult<AnalysisError, DateRangePresetDto, Result<AnalysisError, AnalyseDateRangeRequestDto>>({
        failure,
        success: (allowedPreset) => success(presetDto(allowedPreset)),
      })(decodeAllowedString(dateRangePresets, 'dateRange.preset must be 7D, 30D, 90D or 1Y.')(preset)),
  })(
    mapFailure(() => dateRangeShapeError('dateRange.preset must be 7D, 30D, 90D or 1Y.'))(
      decodeString(['dateRange', 'preset'])(readField('preset')(record)),
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
): Result<AnalysisError, AnalyseDateRangeRequestDto> =>
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
): (record: Readonly<Record<string, unknown>>) => Result<AnalysisError, AnalyseDateRangeRequestDto> =>
  ({
    Custom: decodeCustom,
    Preset: decodePreset,
  })[tag]

const decodeDateRange = (
  record: Readonly<Record<string, unknown>>,
): Result<AnalysisError, AnalyseDateRangeRequestDto> =>
  matchResult<AnalysisError, Readonly<Record<string, unknown>>, Result<AnalysisError, AnalyseDateRangeRequestDto>>({
    failure,
    success: (dateRangeRecord) =>
      matchResult<AnalysisError, DateRangeTag, Result<AnalysisError, AnalyseDateRangeRequestDto>>({
        failure,
        success: (tag) => dateRangeDecoder(tag)(dateRangeRecord),
      })(decodeDateRangeTag(dateRangeRecord)),
  })(decodeDateRangeRecord(record))

const analyseRequestDto = (
  base: string,
  quote: string,
  dateRange: AnalyseDateRangeRequestDto,
): AnalyseRequestDto => ({
  base,
  quote,
  dateRange,
})

const decodeRecordFields = (record: Readonly<Record<string, unknown>>): Result<AnalysisError, AnalyseRequestDto> =>
  liftResult3(analyseRequestDto)(
    decodeCurrencyField('base')(record),
    decodeCurrencyField('quote')(record),
    decodeDateRange(record),
  )

const decodeAnalyseRequest = (payload: unknown): Result<AnalysisError, AnalyseRequestDto> =>
  matchResult<AnalysisError, Readonly<Record<string, unknown>>, Result<AnalysisError, AnalyseRequestDto>>({
    failure,
    success: decodeRecordFields,
  })(decodeRequestRecord(payload))

const decodeRequestBody = async (request: Request): AsyncResult<AnalysisError, AnalyseRequestDto> =>
  matchResult<AnalysisError, unknown, AsyncResult<AnalysisError, AnalyseRequestDto>>({
    failure: (error) => Promise.resolve(failure(error)),
    success: (payload) => Promise.resolve(decodeAnalyseRequest(payload)),
  })(await readJsonBody(request))

const apiError = (
  code: ApiErrorCodeDto,
  category: ApiErrorDto['category'],
  message: string,
  fieldErrors: ApiErrorDto['fieldErrors'],
): ApiErrorDto => ({
  code,
  category,
  message,
  recoverable: true,
  fieldErrors,
  details: [],
})

const analysisApiCodeByTag: Readonly<Record<AnalysisError['tag'], ApiErrorCodeDto>> = {
  'date-range-error': 'INVALID_DATE_RANGE',
  'invalid-json': 'INVALID_JSON',
  'invalid-request-shape': 'INVALID_REQUEST_SHAPE',
  'provider-payload-invalid': 'PROVIDER_PAYLOAD_INVALID',
  'provider-unavailable': 'PROVIDER_UNAVAILABLE',
  'rate-derivation-unavailable': 'CALCULATION_UNAVAILABLE',
  'unsupported-currency': 'UNSUPPORTED_CURRENCY',
}

type DateRangeAnalysisError = Extract<AnalysisError, { readonly tag: 'date-range-error' }>

const dateRangeErrorApiCode: Readonly<Record<DateRangeAnalysisError['error']['tag'], ApiErrorCodeDto>> = {
  'future-date': 'FUTURE_DATE_NOT_ALLOWED',
  'invalid-date': 'INVALID_DATE_RANGE',
  'invalid-date-range': 'INVALID_DATE_RANGE',
  'unsupported-preset': 'INVALID_DATE_RANGE',
}

const dateRangeApiCode = (error: AnalysisError): ApiErrorCodeDto =>
  matchTag<AnalysisError, ApiErrorCodeDto>({
    'date-range-error': (dateRangeError) =>
      dateRangeErrorApiCode[dateRangeError.error.tag],
    'invalid-json': () => analysisApiCodeByTag['invalid-json'],
    'invalid-request-shape': () => analysisApiCodeByTag['invalid-request-shape'],
    'provider-payload-invalid': () => analysisApiCodeByTag['provider-payload-invalid'],
    'provider-unavailable': () => analysisApiCodeByTag['provider-unavailable'],
    'rate-derivation-unavailable': () => analysisApiCodeByTag['rate-derivation-unavailable'],
    'unsupported-currency': () => analysisApiCodeByTag['unsupported-currency'],
  })(error)

const mapAnalysisErrorToApiError = (error: AnalysisError): ApiErrorDto =>
  matchTag<AnalysisError, ApiErrorDto>({
    'date-range-error': (dateRangeError) =>
      apiError(dateRangeApiCode(error), 'date-range', dateRangeError.error.message, [
        {
          field: dateRangeError.error.field,
          code: dateRangeApiCode(error),
          message: dateRangeError.error.message,
        },
      ]),
    'invalid-json': (invalidJsonError) =>
      apiError('INVALID_JSON', 'validation', invalidJsonError.message, []),
    'invalid-request-shape': (invalidRequestShape) =>
      apiError('INVALID_REQUEST_SHAPE', 'validation', invalidRequestShape.message, [
        {
          field: invalidRequestShape.field,
          code: 'INVALID_REQUEST_SHAPE',
          message: invalidRequestShape.message,
        },
      ]),
    'provider-payload-invalid': (providerPayloadInvalid) =>
      apiError('PROVIDER_PAYLOAD_INVALID', 'provider', providerPayloadInvalid.message, []),
    'provider-unavailable': (providerUnavailable) =>
      apiError('PROVIDER_UNAVAILABLE', 'provider', providerUnavailable.message, []),
    'rate-derivation-unavailable': (rateDerivationUnavailable) =>
      apiError('CALCULATION_UNAVAILABLE', 'calculation', rateDerivationUnavailable.message, []),
    'unsupported-currency': (unsupportedCurrency) =>
      apiError('UNSUPPORTED_CURRENCY', 'currency', unsupportedCurrency.message, [
        {
          field: unsupportedCurrency.field,
          code: 'UNSUPPORTED_CURRENCY',
          message: unsupportedCurrency.message,
        },
      ]),
  })(error)

const runAnalysis =
  (exchangeRateProvider: ExchangeRateProvider) =>
  (input: AnalyseRequestDto): AsyncResult<AnalysisError, PairAnalysisViewModelDto> =>
    analyse({ exchangeRateProvider, today: currentIsoDate() })(input)

export const createAnalysePostHandler =
  (exchangeRateProvider: ExchangeRateProvider) =>
  async (request: Request): Promise<Response> => {
    const requestId = createRequestId()
    const decodedInput = await decodeRequestBody(request)
    const result = await matchResult<AnalysisError, AnalyseRequestDto, AsyncResult<AnalysisError, PairAnalysisViewModelDto>>({
      failure: (error) => Promise.resolve(failure(error)),
      success: runAnalysis(exchangeRateProvider),
    })(decodedInput)

    return toJsonResponse(requestId, mapAnalysisErrorToApiError)(result)
  }
