'use client'

import type { ApiFailureDto, ApiResponseDto } from '@/shared/dto/api'
import type { AnalyseRequestDto, PairAnalysisViewModelDto } from '@/shared/dto/analysis'
import { matchDtoTag, matchTag } from '@/shared/fp'

export type AnalyseClientResult =
  | {
      readonly tag: 'success'
      readonly value: PairAnalysisViewModelDto
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

export const postAnalyseRequest = (input: AnalyseRequestDto): Promise<AnalyseClientResult> =>
  fetch('/api/analyse', {
    body: JSON.stringify(input),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
    .then((response) => response.json())
    .then((body: ApiResponseDto<PairAnalysisViewModelDto>) =>
      matchDtoTag<ApiResponseDto<PairAnalysisViewModelDto>, AnalyseClientResult>({
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

export const matchAnalyseClientResult =
  <A>(handlers: {
    readonly failure: (error: ApiFailureDto['error']) => A
    readonly success: (value: PairAnalysisViewModelDto) => A
  }) =>
  (result: AnalyseClientResult): A =>
    matchTag<AnalyseClientResult, A>({
      failure: (failureResult) => handlers.failure(failureResult.error),
      success: (successResult) => handlers.success(successResult.value),
    })(result)
