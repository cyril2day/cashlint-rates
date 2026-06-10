import { describe, expect, it } from 'vitest'
import { createComparePostHandler } from '@/server/application/comparison/compare-route-handler'
import type { ApiErrorDto, ApiFailureDto, ApiResponseDto, ApiSuccessDto } from '@/shared/dto/api'
import type { ComparisonViewModelDto } from '@/shared/dto/comparison'
import { matchDtoTag } from '@/shared/fp'
import { successfulRateProvider } from '../../helpers/fake-rate-provider'

const jsonRequest = (body: unknown): Request =>
  new Request('https://cashlint.test/api/compare', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })

const readCompareResponse = async (response: Response): Promise<ApiResponseDto<ComparisonViewModelDto>> =>
  response.json().then((body: ApiResponseDto<ComparisonViewModelDto>) => body)

const expectApiSuccess = (
  body: ApiResponseDto<ComparisonViewModelDto>,
): ApiSuccessDto<ComparisonViewModelDto> =>
  matchDtoTag<ApiResponseDto<ComparisonViewModelDto>, ApiSuccessDto<ComparisonViewModelDto>>({
    ApiFailure: (failureBody) => {
      throw new Error(`Expected ApiSuccess, got ${failureBody.error.code}`)
    },
    ApiSuccess: (successBody) => successBody,
  })(body)

const expectApiFailure = (
  body: ApiResponseDto<ComparisonViewModelDto>,
): ApiFailureDto =>
  matchDtoTag<ApiResponseDto<ComparisonViewModelDto>, ApiFailureDto>({
    ApiFailure: (failureBody) => failureBody,
    ApiSuccess: () => {
      throw new Error('Expected ApiFailure, got ApiSuccess')
    },
  })(body)

const expectFailureCode = (
  body: ApiResponseDto<ComparisonViewModelDto>,
  code: ApiErrorDto['code'],
): void => {
  expect(expectApiFailure(body).error.code).toBe(code)
}

describe('POST /api/compare', () => {
  it('returns a comparison view model in the standard API envelope', async () => {
    const response = await createComparePostHandler(successfulRateProvider())(
      jsonRequest({ base: 'USD', quotes: ['GBP'], dateRange: { _tag: 'Preset', preset: '7D' } }),
    )
    const body = await readCompareResponse(response)

    expect(response.status).toBe(200)
    expect(expectApiSuccess(body).data.mode).toBe('comparison')
  })

  it('returns NO_QUOTES_SELECTED for an empty quote list', async () => {
    const response = await createComparePostHandler(successfulRateProvider())(
      jsonRequest({ base: 'USD', quotes: [], dateRange: { _tag: 'Preset', preset: '7D' } }),
    )
    const body = await readCompareResponse(response)

    expect(response.status).toBe(400)
    expectFailureCode(body, 'NO_QUOTES_SELECTED')
  })

  it('returns QUOTE_LIMIT_EXCEEDED for more than ten quotes', async () => {
    const response = await createComparePostHandler(successfulRateProvider())(
      jsonRequest({
        base: 'USD',
        quotes: ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'PHP', 'USD', 'EUR', 'GBP'],
        dateRange: { _tag: 'Preset', preset: '7D' },
      }),
    )
    const body = await readCompareResponse(response)

    expect(response.status).toBe(400)
    expectFailureCode(body, 'QUOTE_LIMIT_EXCEEDED')
  })
})
