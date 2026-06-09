import { describe, expect, it } from 'vitest'
import { createConvertPostHandler } from '@/server/application/conversion/convert-route-handler'
import type { ApiErrorDto, ApiFailureDto, ApiResponseDto, ApiSuccessDto } from '@/shared/dto/api'
import type { ConversionViewModelDto } from '@/shared/dto/conversion'
import { matchDtoTag } from '@/shared/fp'
import { failingRateProvider, successfulRateProvider } from '../../helpers/fake-rate-provider'

const jsonRequest = (body: unknown): Request =>
  new Request('https://cashlint.test/api/convert', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })

const readConvertResponse = async (response: Response): Promise<ApiResponseDto<ConversionViewModelDto>> =>
  response.json().then((body: ApiResponseDto<ConversionViewModelDto>) => body)

const expectApiSuccess = (
  body: ApiResponseDto<ConversionViewModelDto>,
): ApiSuccessDto<ConversionViewModelDto> =>
  matchDtoTag<ApiResponseDto<ConversionViewModelDto>, ApiSuccessDto<ConversionViewModelDto>>({
    ApiFailure: (failureBody) => {
      throw new Error(`Expected ApiSuccess, got ${failureBody.error.code}`)
    },
    ApiSuccess: (successBody) => successBody,
  })(body)

const expectApiFailure = (
  body: ApiResponseDto<ConversionViewModelDto>,
): ApiFailureDto =>
  matchDtoTag<ApiResponseDto<ConversionViewModelDto>, ApiFailureDto>({
    ApiFailure: (failureBody) => failureBody,
    ApiSuccess: () => {
      throw new Error('Expected ApiFailure, got ApiSuccess')
    },
  })(body)

const expectFailureCode = (
  body: ApiResponseDto<ConversionViewModelDto>,
  code: ApiErrorDto['code'],
): void => {
  expect(expectApiFailure(body).error.code).toBe(code)
}

describe('POST /api/convert', () => {
  it('returns a conversion view model in the standard API envelope', async () => {
    const response = await createConvertPostHandler(successfulRateProvider())(
      jsonRequest({ amount: 1000, base: 'USD', quote: 'GBP' }),
    )
    const body = await readConvertResponse(response)

    expect(response.status).toBe(200)
    expect(body._tag).toBe('ApiSuccess')
    expect(expectApiSuccess(body).data.result.convertedAmount.rawValue).toBe(800)
  })

  it('returns INVALID_AMOUNT for invalid amounts', async () => {
    const response = await createConvertPostHandler(successfulRateProvider())(
      jsonRequest({ amount: -5, base: 'USD', quote: 'GBP' }),
    )
    const body = await readConvertResponse(response)

    expect(response.status).toBe(400)
    expect(body._tag).toBe('ApiFailure')
    expectFailureCode(body, 'INVALID_AMOUNT')
  })

  it('returns UNSUPPORTED_CURRENCY for currencies outside the catalogue', async () => {
    const response = await createConvertPostHandler(successfulRateProvider())(
      jsonRequest({ amount: 1000, base: 'USD', quote: 'XYZ' }),
    )
    const body = await readConvertResponse(response)

    expect(response.status).toBe(400)
    expect(body._tag).toBe('ApiFailure')
    expectFailureCode(body, 'UNSUPPORTED_CURRENCY')
  })

  it('returns PROVIDER_UNAVAILABLE for provider failures', async () => {
    const response = await createConvertPostHandler(
      failingRateProvider({ tag: 'network', message: 'offline' }),
    )(jsonRequest({ amount: 1000, base: 'USD', quote: 'GBP' }))
    const body = await readConvertResponse(response)

    expect(response.status).toBe(503)
    expect(body._tag).toBe('ApiFailure')
    expectFailureCode(body, 'PROVIDER_UNAVAILABLE')
  })
})
