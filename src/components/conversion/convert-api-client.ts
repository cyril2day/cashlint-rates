'use client'

import type { ApiFailureDto, ApiResponseDto } from '@/shared/dto/api'
import type { ConvertRequestDto, ConversionViewModelDto } from '@/shared/dto/conversion'

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
    .then((response) => response.json() as Promise<ApiResponseDto<ConversionViewModelDto>>)
    .then((body) =>
      ({
        ApiFailure: () => ({
          tag: 'failure' as const,
          error: (body as ApiFailureDto).error,
        }),
        ApiSuccess: () => ({
          tag: 'success' as const,
          value: (body as { readonly data: ConversionViewModelDto }).data,
        }),
      })[body._tag](),
    )
    .catch(() => ({
      tag: 'failure' as const,
      error: fallbackError,
    }))

export const matchConvertClientResult =
  <A>(handlers: {
    readonly failure: (error: ApiFailureDto['error']) => A
    readonly success: (value: ConversionViewModelDto) => A
  }) =>
  (result: ConvertClientResult): A =>
    ({
      failure: () => handlers.failure((result as { readonly error: ApiFailureDto['error'] }).error),
      success: () => handlers.success((result as { readonly value: ConversionViewModelDto }).value),
    })[result.tag]()
