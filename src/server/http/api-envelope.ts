import type {
  ApiErrorCategoryDto,
  ApiErrorDto,
  ApiFailureDto,
  ApiResponseDto,
  ApiSuccessDto,
  ContractVersionDto,
} from '@/shared/dto/api'
import { matchResult, type Result } from '@/shared/fp'

export const contractVersion: ContractVersionDto = '2026-06-09'

export const createRequestId = (): string => crypto.randomUUID()

export const apiSuccess = <A>(requestId: string, data: A): ApiSuccessDto<A> => ({
  _tag: 'ApiSuccess',
  contractVersion,
  requestId,
  data,
  warnings: [],
})

export const apiFailure = (requestId: string, error: ApiErrorDto): ApiFailureDto => ({
  _tag: 'ApiFailure',
  contractVersion,
  requestId,
  error,
  warnings: [],
})

export const unexpectedBoundaryError = (): ApiErrorDto => ({
  code: 'UNEXPECTED_BOUNDARY_ERROR',
  category: 'unexpected-boundary',
  message: 'Something unexpected happened while handling the request.',
  recoverable: true,
  fieldErrors: [],
  details: [],
})

const statusByCategory: Readonly<Record<ApiErrorCategoryDto, number>> = {
  validation: 400,
  currency: 400,
  'date-range': 400,
  provider: 503,
  'data-quality': 422,
  calculation: 422,
  formula: 500,
  bogart: 422,
  'rate-limit': 429,
  'unexpected-boundary': 500,
}

export const toApiResponse =
  <E, A>(requestId: string, mapError: (error: E) => ApiErrorDto) =>
  (result: Result<E, A>): ApiResponseDto<A> =>
    matchResult<E, A, ApiResponseDto<A>>({
      failure: (error) => apiFailure(requestId, mapError(error)),
      success: (value) => apiSuccess(requestId, value),
    })(result)

export const toJsonResponse =
  <E, A>(requestId: string, mapError: (error: E) => ApiErrorDto) =>
  (result: Result<E, A>): Response => {
    const body = toApiResponse(requestId, mapError)(result)
    const responseStatus = matchResult<E, A, number>({
      failure: (error) => statusByCategory[mapError(error).category],
      success: () => 200,
    })(result)

    return Response.json(body, { status: responseStatus })
  }
