import { askBogart, validateBogartQuestion, type BogartError } from '@/server/application/bogart/bogart'
import { createRequestId, toJsonResponse } from '@/server/http/api-envelope'
import {
  decodeNonEmptyString,
  decodeReadonlyArray,
  decodeRecord,
  decodeString,
  readField,
  type JsonRecord,
} from '@/server/http/request-validation'
import type { AIExplanationProvider } from '@/server/ports/ai-explanation-provider'
import type { BogartRateLimiter } from '@/server/ports/bogart-rate-limiter'
import { currentIsoDate } from '@/shared/date'
import type { ApiErrorCodeDto, ApiErrorDto, FieldErrorDto } from '@/shared/dto/api'
import type { BogartRequestDto, BogartResponseViewModelDto, BogartResultContextDto } from '@/shared/dto/bogart'
import {
  allTrue,
  chainResult,
  failure,
  fromNullable,
  fromTypeGuard,
  liftResult3,
  mapFailure,
  matchBoolean,
  matchMaybe,
  matchResult,
  matchTag,
  success,
  type AsyncResult,
  type Result,
} from '@/shared/fp'

type BogartContextMode = BogartResultContextDto['mode']

const contextModes: ReadonlyArray<BogartContextMode> = ['conversion', 'pair-analysis', 'comparison']

const invalidJson: BogartError = {
  tag: 'invalid-json',
  message: 'Request body must be valid JSON.',
}

const invalidShape = (field: string, message: string): BogartError => ({
  tag: 'invalid-request-shape',
  field,
  message,
})

const readJsonBody = async (request: Request): AsyncResult<BogartError, unknown> => {
  try {
    return success(await request.json())
  } catch {
    return failure(invalidJson)
  }
}

const decodeRequestRecord = (payload: unknown): Result<BogartError, JsonRecord> =>
  mapFailure(() => invalidShape('body', 'Request body must be an object.'))(
    decodeRecord([])(payload),
  )

const decodeQuestion = (record: JsonRecord): Result<BogartError, string> =>
  chainResult<BogartError, string, string>(validateBogartQuestion)(
    mapFailure(() => invalidShape('question', 'Question must be a non-empty string.'))(
      decodeNonEmptyString(['question'])(readField('question')(record)),
    ),
  )

const decodeAnonymousUserKey = (record: JsonRecord): Result<BogartError, string> =>
  mapFailure(() => invalidShape('anonymousUserKey', 'anonymousUserKey must be a non-empty string.'))(
    decodeNonEmptyString(['anonymousUserKey'])(readField('anonymousUserKey')(record)),
  )

const allowedMode = (mode: string): Result<BogartError, BogartContextMode> =>
  matchMaybe<BogartContextMode, Result<BogartError, BogartContextMode>>({
    none: () => failure(invalidShape('context.mode', 'context.mode must be conversion, pair-analysis or comparison.')),
    some: success,
  })(fromNullable(contextModes.find((candidate) => candidate === mode)))

const decodeMode = (context: JsonRecord): Result<BogartError, BogartContextMode> =>
  chainResult<BogartError, string, BogartContextMode>(allowedMode)(
    mapFailure(() => invalidShape('context.mode', 'context.mode must be a string.'))(
      decodeString(['context', 'mode'])(readField('mode')(context)),
    ),
  )

const decodeSelectedCurrencies = (context: JsonRecord): Result<BogartError, JsonRecord> =>
  mapFailure(() => invalidShape('context.selectedCurrencies', 'Bogart context must include selected currencies.'))(
    decodeRecord(['context', 'selectedCurrencies'])(readField('selectedCurrencies')(context)),
  )

const decodeBase = (selectedCurrencies: JsonRecord): Result<BogartError, string> =>
  mapFailure(() => invalidShape('context.selectedCurrencies.base', 'Bogart context base currency is invalid.'))(
    decodeString(['context', 'selectedCurrencies', 'base'])(readField('base')(selectedCurrencies)),
  )

const decodeQuotes = (selectedCurrencies: JsonRecord): Result<BogartError, ReadonlyArray<string>> =>
  mapFailure(() => invalidShape('context.selectedCurrencies.quotes', 'Bogart context quote currencies are invalid.'))(
    decodeReadonlyArray(
      ['context', 'selectedCurrencies', 'quotes'],
      decodeString(['context', 'selectedCurrencies', 'quotes']),
    )(readField('quotes')(selectedCurrencies)),
  )

const decodeKeyResults = (context: JsonRecord): Result<BogartError, ReadonlyArray<unknown>> =>
  mapFailure(() => invalidShape('context.keyResults', 'Bogart context must include key results.'))(
    decodeReadonlyArray(['context', 'keyResults'], success)(readField('keyResults')(context)),
  )

const decodeContextUsefulness = (record: JsonRecord): Result<BogartError, boolean> => {
  const selectedCurrencies = decodeSelectedCurrencies(record)
  const base = chainResult<BogartError, JsonRecord, string>(decodeBase)(selectedCurrencies)
  const quotes = chainResult<BogartError, JsonRecord, ReadonlyArray<string>>(decodeQuotes)(selectedCurrencies)
  const keyResults = decodeKeyResults(record)

  return liftResult3((baseCode: string, quoteCodes: ReadonlyArray<string>, results: ReadonlyArray<unknown>) =>
    allTrue([baseCode.length === 3, quoteCodes.length > 0, results.length > 0]),
  )(base, quotes, keyResults)
}

const isBogartResultContext = (value: unknown): value is BogartResultContextDto => {
  const context = mapFailure(() => invalidShape('context', 'context must be an object.'))(
    decodeRecord(['context'])(value),
  )
  const usefulContext = chainResult<BogartError, JsonRecord, boolean>(decodeContextUsefulness)(context)

  return matchResult<BogartError, boolean, boolean>({
    failure: () => false,
    success: (useful) => useful,
  })(usefulContext)
}

const requireUsefulContext = (useful: boolean): Result<BogartError, boolean> =>
  matchBoolean<Result<BogartError, boolean>>({
    false: () => failure(invalidShape('context', 'Bogart context must come from a current Cashlint result.')),
    true: () => success(useful),
  })(useful)

const validatedContextValue = (context: JsonRecord): Result<BogartError, BogartResultContextDto> =>
  fromTypeGuard<BogartError, BogartResultContextDto>(
    isBogartResultContext,
    () => invalidShape('context', 'Bogart context must come from a current Cashlint result.'),
  )(context)

const validateContextShape = (context: JsonRecord): Result<BogartError, BogartResultContextDto> => {
  const mode = decodeMode(context)
  const usefulContext = chainResult<BogartError, boolean, boolean>(requireUsefulContext)(
    decodeContextUsefulness(context),
  )
  const validContext = chainResult<BogartError, boolean, BogartResultContextDto>(() =>
    validatedContextValue(context),
  )(usefulContext)

  return liftResult3((
    _mode: BogartContextMode,
    _useful: boolean,
    valid: BogartResultContextDto,
  ) => valid)(mode, usefulContext, validContext)
}

const decodeContext = (record: JsonRecord): Result<BogartError, BogartResultContextDto> =>
  chainResult<BogartError, JsonRecord, BogartResultContextDto>(validateContextShape)(
    mapFailure(() => invalidShape('context', 'context must be an object.'))(
      decodeRecord(['context'])(readField('context')(record)),
    ),
  )

const bogartRequestDto = (
  question: string,
  context: BogartResultContextDto,
  anonymousUserKey: string,
): BogartRequestDto => ({
  anonymousUserKey,
  context,
  question,
})

const decodeBogartRequest = (payload: unknown): Result<BogartError, BogartRequestDto> =>
  chainResult<BogartError, JsonRecord, BogartRequestDto>((record) =>
    liftResult3(bogartRequestDto)(
      decodeQuestion(record),
      decodeContext(record),
      decodeAnonymousUserKey(record),
    ),
  )(decodeRequestRecord(payload))

const decodeRequestBody = async (request: Request): AsyncResult<BogartError, BogartRequestDto> =>
  Promise.resolve(
    chainResult<BogartError, unknown, BogartRequestDto>(decodeBogartRequest)(await readJsonBody(request)),
  )

const apiError = (
  code: ApiErrorCodeDto,
  category: ApiErrorDto['category'],
  message: string,
  fieldErrors: ReadonlyArray<FieldErrorDto>,
): ApiErrorDto => ({
  category,
  code,
  details: [],
  fieldErrors,
  message,
  recoverable: true,
})

const fieldError = (field: string, code: string, message: string): FieldErrorDto => ({
  code,
  field,
  message,
})

const mapInvalidShapeError = (error: Extract<BogartError, { readonly tag: 'invalid-request-shape' }>): ApiErrorDto =>
  apiError('INVALID_REQUEST_SHAPE', 'validation', error.message, [
    fieldError(error.field, 'INVALID_REQUEST_SHAPE', error.message),
  ])

const mapBogartErrorToApiError = (error: BogartError): ApiErrorDto =>
  matchTag<BogartError, ApiErrorDto>({
    'context-invalid': (contextError) =>
      apiError('BOGART_CONTEXT_INVALID', 'bogart', contextError.message, []),
    'invalid-json': (jsonError) =>
      apiError('INVALID_JSON', 'validation', jsonError.message, []),
    'invalid-request-shape': mapInvalidShapeError,
    'provider-unavailable': (providerError) =>
      apiError('BOGART_PROVIDER_UNAVAILABLE', 'provider', providerError.message, []),
    'rate-limit-state-unavailable': (limitError) =>
      apiError('RATE_LIMIT_STATE_UNAVAILABLE', 'rate-limit', limitError.message, []),
  })(error)

const runBogart =
  (aiProvider: AIExplanationProvider, rateLimiter: BogartRateLimiter) =>
  (input: BogartRequestDto): AsyncResult<BogartError, BogartResponseViewModelDto> =>
    askBogart({ aiProvider, rateLimiter, today: currentIsoDate() })(input)

export const createBogartPostHandler =
  (aiProvider: AIExplanationProvider, rateLimiter: BogartRateLimiter) =>
  async (request: Request): Promise<Response> => {
    const requestId = createRequestId()
    const decodedInput = await decodeRequestBody(request)
    const result = await matchResult<BogartError, BogartRequestDto, AsyncResult<BogartError, BogartResponseViewModelDto>>({
      failure: (error) => Promise.resolve(failure(error)),
      success: runBogart(aiProvider, rateLimiter),
    })(decodedInput)

    return toJsonResponse(requestId, mapBogartErrorToApiError)(result)
  }
