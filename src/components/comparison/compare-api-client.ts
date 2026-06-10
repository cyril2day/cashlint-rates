'use client'

import type { ApiFailureDto, ApiResponseDto } from '@/shared/dto/api'
import type { CompareRequestDto, ComparisonViewModelDto } from '@/shared/dto/comparison'
import { matchDtoTag, matchTag } from '@/shared/fp'

export type CompareClientResult =
  | {
      readonly tag: 'success'
      readonly value: ComparisonViewModelDto
    }
  | {
      readonly tag: 'failure'
      readonly error: ApiFailureDto['error']
    }

const fallbackError: ApiFailureDto['error'] = {
  code: 'PROVIDER_UNAVAILABLE',
  category: 'provider',
  message: 'We could not load historical reference rates just now. Please try again.',
  recoverable: true,
  fieldErrors: [],
  details: [],
}

export const postCompareRequest = (input: CompareRequestDto): Promise<CompareClientResult> =>
  fetch('/api/compare', {
    body: JSON.stringify(input),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
    .then((response) => response.json())
    .then((body: ApiResponseDto<ComparisonViewModelDto>) =>
      matchDtoTag<ApiResponseDto<ComparisonViewModelDto>, CompareClientResult>({
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

export const matchCompareClientResult =
  <A>(handlers: {
    readonly failure: (error: ApiFailureDto['error']) => A
    readonly success: (value: ComparisonViewModelDto) => A
  }) =>
  (result: CompareClientResult): A =>
    matchTag<CompareClientResult, A>({
      failure: (failureResult) => handlers.failure(failureResult.error),
      success: (successResult) => handlers.success(successResult.value),
    })(result)
