'use client'

import type { ApiFailureDto, ApiResponseDto } from '@/shared/dto/api'
import type { ConvertRequestDto, ConversionViewModelDto } from '@/shared/dto/conversion'
import { matchDtoTag, matchTag } from '@/shared/fp'

export type ConvertClientResult =
  | {
      readonly tag: 'success'
      readonly value: ConversionViewModelDto
    }
  | {
      readonly tag: 'failure'
      readonly error: ApiFailureDto['error']
    }

const fallbackError: ApiFailureDto['error'] = {
  code: 'PROVIDER_UNAVAILABLE',
  category: 'provider',
  message: 'We could not load the latest reference rate just now. Please try again.',
  recoverable: true,
  fieldErrors: [],
  details: [],
}

export const postConversionRequest = (input: ConvertRequestDto): Promise<ConvertClientResult> =>
  fetch('/api/convert', {
    body: JSON.stringify(input),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
    .then((response) => response.json())
    .then((body: ApiResponseDto<ConversionViewModelDto>) =>
      matchDtoTag<ApiResponseDto<ConversionViewModelDto>, ConvertClientResult>({
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

export const matchConvertClientResult =
  <A>(handlers: {
    readonly failure: (error: ApiFailureDto['error']) => A
    readonly success: (value: ConversionViewModelDto) => A
  }) =>
  (result: ConvertClientResult): A =>
    matchTag<ConvertClientResult, A>({
      failure: (failureResult) => handlers.failure(failureResult.error),
      success: (successResult) => handlers.success(successResult.value),
    })(result)
