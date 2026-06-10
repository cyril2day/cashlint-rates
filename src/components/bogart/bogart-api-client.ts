'use client'

import type { ApiFailureDto, ApiResponseDto } from '@/shared/dto/api'
import type { BogartRequestDto, BogartResponseViewModelDto } from '@/shared/dto/bogart'
import { matchDtoTag, matchTag } from '@/shared/fp'

export type BogartClientResult =
  | {
      readonly tag: 'success'
      readonly value: BogartResponseViewModelDto
    }
  | {
      readonly tag: 'failure'
      readonly error: ApiFailureDto['error']
    }

const fallbackError: ApiFailureDto['error'] = {
  category: 'bogart',
  code: 'BOGART_PROVIDER_UNAVAILABLE',
  details: [],
  fieldErrors: [],
  message: 'Explanation is not available at the moment.',
  recoverable: true,
}

export const postBogartRequest = (input: BogartRequestDto): Promise<BogartClientResult> =>
  fetch('/api/bogart', {
    body: JSON.stringify(input),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
    .then((response) => response.json())
    .then((body: ApiResponseDto<BogartResponseViewModelDto>) =>
      matchDtoTag<ApiResponseDto<BogartResponseViewModelDto>, BogartClientResult>({
        ApiFailure: (failureBody) => ({
          tag: 'failure',
          error: failureBody.error,
        }),
        ApiSuccess: (successBody) => ({
          tag: 'success',
          value: successBody.data,
        }),
      })(body),
    )
    .catch(() => ({
      tag: 'failure',
      error: fallbackError,
    }))

export const matchBogartClientResult =
  <A>(handlers: {
    readonly failure: (error: ApiFailureDto['error']) => A
    readonly success: (value: BogartResponseViewModelDto) => A
  }) =>
  (result: BogartClientResult): A =>
    matchTag<BogartClientResult, A>({
      failure: (failureResult) => handlers.failure(failureResult.error),
      success: (successResult) => handlers.success(successResult.value),
    })(result)
