import {
  convert,
  toConversionViewModel,
} from '@/server/application/conversion/convert'
import type { ConversionError } from '@/server/domain/rates/conversion'
import { createRequestId, toJsonResponse } from '@/server/http/api-envelope'
import { decodeCurrencyCodeCandidate, decodeFiniteNumber, decodeRecord, readField } from '@/server/http/request-validation'
import type { ExchangeRateProvider } from '@/server/ports/rate-provider'
import type { ApiErrorDto } from '@/shared/dto/api'
import type { ConvertRequestDto, ConversionViewModelDto } from '@/shared/dto/conversion'
import {
  chainResult,
  failure,
  liftResult3,
  mapFailure,
  mapResult,
  matchResult,
  matchTag,
  success,
  type AsyncResult,
  type Result,
} from '@/shared/fp'

const invalidJson: ConversionError = {
  tag: 'invalid-json',
  message: 'Request body must be valid JSON.',
}

const invalidShape = (field: string, message: string): ConversionError => ({
  tag: 'invalid-request-shape',
  field,
  message,
})

const invalidCurrencyCode = (field: 'base' | 'quote'): ConversionError => ({
  tag: 'invalid-request-shape',
  field,
  message: `${field} must be a 3-letter currency code.`,
})

const readJsonBody = async (request: Request): AsyncResult<ConversionError, unknown> => {
  try {
    return success(await request.json())
  } catch {
    return failure(invalidJson)
  }
}

const decodeAmountError: ConversionError = {
  tag: 'invalid-amount',
  field: 'amount',
  message: 'Enter an amount greater than 0.',
}

const decodeAmount = (record: Readonly<Record<string, unknown>>): Result<ConversionError, number> =>
  mapFailure(() => decodeAmountError)(
    decodeFiniteNumber(['amount'])(readField('amount')(record)),
  )

const decodeCurrencyField =
  (field: 'base' | 'quote') =>
  (record: Readonly<Record<string, unknown>>): Result<ConversionError, string> =>
    mapFailure(() => invalidCurrencyCode(field))(
      decodeCurrencyCodeCandidate([field])(readField(field)(record)),
    )

const decodeRequestRecord = (payload: unknown): Result<ConversionError, Readonly<Record<string, unknown>>> =>
  mapFailure(() => invalidShape('body', 'Request body must be an object.'))(
    decodeRecord([])(payload),
  )

const convertRequestDto = (
  amount: number,
  base: string,
  quote: string,
): ConvertRequestDto => ({
  amount,
  base,
  quote,
})

const decodeRecordFields = (record: Readonly<Record<string, unknown>>): Result<ConversionError, ConvertRequestDto> =>
  liftResult3(convertRequestDto)(
    decodeAmount(record),
    decodeCurrencyField('base')(record),
    decodeCurrencyField('quote')(record),
  )

const decodeConvertRequest = (payload: unknown): Result<ConversionError, ConvertRequestDto> =>
  chainResult<ConversionError, Readonly<Record<string, unknown>>, ConvertRequestDto>(decodeRecordFields)(
    decodeRequestRecord(payload),
  )

const apiError = (
  code: ApiErrorDto['code'],
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

const mapConversionErrorToApiError = (error: ConversionError): ApiErrorDto =>
  matchTag<ConversionError, ApiErrorDto>({
    'invalid-amount': (invalidAmount) =>
      apiError('INVALID_AMOUNT', 'validation', invalidAmount.message, [
        { field: invalidAmount.field, code: 'INVALID_AMOUNT', message: invalidAmount.message },
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
    'unsupported-currency': (unsupportedCurrencyError) =>
      apiError('UNSUPPORTED_CURRENCY', 'currency', unsupportedCurrencyError.message, [
        {
          field: unsupportedCurrencyError.field,
          code: 'UNSUPPORTED_CURRENCY',
          message: unsupportedCurrencyError.message,
        },
      ]),
  })(error)

const decodeRequestBody = async (request: Request): AsyncResult<ConversionError, ConvertRequestDto> =>
  Promise.resolve(
    chainResult<ConversionError, unknown, ConvertRequestDto>(decodeConvertRequest)(await readJsonBody(request)),
  )

const runConversion =
  (exchangeRateProvider: ExchangeRateProvider) =>
  (input: ConvertRequestDto): AsyncResult<ConversionError, ConversionViewModelDto> =>
    convert({ exchangeRateProvider })(input).then(mapResult(toConversionViewModel))

export const createConvertPostHandler =
  (exchangeRateProvider: ExchangeRateProvider) =>
  async (request: Request): Promise<Response> => {
    const requestId = createRequestId()
    const decodedInput = await decodeRequestBody(request)
    const result = await matchResult<ConversionError, ConvertRequestDto, AsyncResult<ConversionError, ConversionViewModelDto>>({
      failure: (error) => Promise.resolve(failure(error)),
      success: runConversion(exchangeRateProvider),
    })(decodedInput)

    return toJsonResponse(requestId, mapConversionErrorToApiError)(result)
  }
