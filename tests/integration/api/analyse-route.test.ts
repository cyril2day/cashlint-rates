import { describe, expect, it } from 'vitest'
import { createAnalysePostHandler } from '@/server/application/analysis/analyse-route-handler'
import type { ApiErrorDto, ApiFailureDto, ApiResponseDto, ApiSuccessDto } from '@/shared/dto/api'
import type { PairAnalysisViewModelDto } from '@/shared/dto/analysis'
import { matchDtoTag } from '@/shared/fp'
import { failingRateProvider, successfulRateProvider } from '../../helpers/fake-rate-provider'

const jsonRequest = (body: unknown): Request =>
  new Request('https://cashlint.test/api/analyse', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })

const readAnalyseResponse = async (response: Response): Promise<ApiResponseDto<PairAnalysisViewModelDto>> =>
  response.json().then((body: ApiResponseDto<PairAnalysisViewModelDto>) => body)

const expectApiSuccess = (
  body: ApiResponseDto<PairAnalysisViewModelDto>,
): ApiSuccessDto<PairAnalysisViewModelDto> =>
  matchDtoTag<ApiResponseDto<PairAnalysisViewModelDto>, ApiSuccessDto<PairAnalysisViewModelDto>>({
    ApiFailure: (failureBody) => {
      throw new Error(`Expected ApiSuccess, got ${failureBody.error.code}`)
    },
    ApiSuccess: (successBody) => successBody,
  })(body)

const expectApiFailure = (
  body: ApiResponseDto<PairAnalysisViewModelDto>,
): ApiFailureDto =>
  matchDtoTag<ApiResponseDto<PairAnalysisViewModelDto>, ApiFailureDto>({
    ApiFailure: (failureBody) => failureBody,
    ApiSuccess: () => {
      throw new Error('Expected ApiFailure, got ApiSuccess')
    },
  })(body)

const expectFailureCode = (
  body: ApiResponseDto<PairAnalysisViewModelDto>,
  code: ApiErrorDto['code'],
): void => {
  expect(expectApiFailure(body).error.code).toBe(code)
}

describe('POST /api/analyse', () => {
  it('returns an analysis view model in the standard API envelope', async () => {
    const response = await createAnalysePostHandler(successfulRateProvider())(
      jsonRequest({ base: 'USD', quote: 'GBP', dateRange: { _tag: 'Preset', preset: '7D' } }),
    )
    const body = await readAnalyseResponse(response)

    expect(response.status).toBe(200)
    expect(body._tag).toBe('ApiSuccess')
    expect(expectApiSuccess(body).data.mode).toBe('pair-analysis')
  })

  it('returns INVALID_DATE_RANGE for invalid custom chronology', async () => {
    const response = await createAnalysePostHandler(successfulRateProvider())(
      jsonRequest({
        base: 'USD',
        quote: 'GBP',
        dateRange: { _tag: 'Custom', startDate: '2026-06-08', endDate: '2026-06-01' },
      }),
    )
    const body = await readAnalyseResponse(response)

    expect(response.status).toBe(400)
    expectFailureCode(body, 'INVALID_DATE_RANGE')
  })

  it('returns UNSUPPORTED_CURRENCY for currencies outside the catalogue', async () => {
    const response = await createAnalysePostHandler(successfulRateProvider())(
      jsonRequest({ base: 'USD', quote: 'XYZ', dateRange: { _tag: 'Preset', preset: '7D' } }),
    )
    const body = await readAnalyseResponse(response)

    expect(response.status).toBe(400)
    expectFailureCode(body, 'UNSUPPORTED_CURRENCY')
  })

  it('returns PROVIDER_UNAVAILABLE for provider failures', async () => {
    const response = await createAnalysePostHandler(
      failingRateProvider({ tag: 'network', message: 'offline' }),
    )(jsonRequest({ base: 'USD', quote: 'GBP', dateRange: { _tag: 'Preset', preset: '7D' } }))
    const body = await readAnalyseResponse(response)

    expect(response.status).toBe(503)
    expectFailureCode(body, 'PROVIDER_UNAVAILABLE')
  })
})
