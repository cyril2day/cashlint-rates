import { describe, expect, it } from 'vitest'
import { createConvertPostHandler } from '@/server/application/conversion/convert-route-handler'
import type { ApiResponseDto } from '@/shared/dto/api'
import type { ConversionViewModelDto } from '@/shared/dto/conversion'
import { failingRateProvider, successfulRateProvider } from '../../helpers/fake-rate-provider'

const jsonRequest = (body: unknown): Request =>
  new Request('https://cashlint.test/api/convert', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })

describe('POST /api/convert', () => {
  it('returns a conversion view model in the standard API envelope', async () => {
    const response = await createConvertPostHandler(successfulRateProvider())(
      jsonRequest({ amount: 1000, base: 'USD', quote: 'GBP' }),
    )
    const body = await response.json() as ApiResponseDto<ConversionViewModelDto>

    expect(response.status).toBe(200)
    expect(body._tag).toBe('ApiSuccess')
    expect((body as { readonly data: ConversionViewModelDto }).data.result.convertedAmount.rawValue).toBe(800)
  })

  it('returns INVALID_AMOUNT for invalid amounts', async () => {
    const response = await createConvertPostHandler(successfulRateProvider())(
      jsonRequest({ amount: -5, base: 'USD', quote: 'GBP' }),
    )
    const body = await response.json() as ApiResponseDto<ConversionViewModelDto>

    expect(response.status).toBe(400)
    expect(body._tag).toBe('ApiFailure')
    expect((body as { readonly error: { readonly code: string } }).error.code).toBe('INVALID_AMOUNT')
  })

  it('returns UNSUPPORTED_CURRENCY for currencies outside the catalogue', async () => {
    const response = await createConvertPostHandler(successfulRateProvider())(
      jsonRequest({ amount: 1000, base: 'USD', quote: 'XYZ' }),
    )
    const body = await response.json() as ApiResponseDto<ConversionViewModelDto>

    expect(response.status).toBe(400)
    expect(body._tag).toBe('ApiFailure')
    expect((body as { readonly error: { readonly code: string } }).error.code).toBe('UNSUPPORTED_CURRENCY')
  })

  it('returns PROVIDER_UNAVAILABLE for provider failures', async () => {
    const response = await createConvertPostHandler(
      failingRateProvider({ tag: 'network', message: 'offline' }),
    )(jsonRequest({ amount: 1000, base: 'USD', quote: 'GBP' }))
    const body = await response.json() as ApiResponseDto<ConversionViewModelDto>

    expect(response.status).toBe(503)
    expect(body._tag).toBe('ApiFailure')
    expect((body as { readonly error: { readonly code: string } }).error.code).toBe('PROVIDER_UNAVAILABLE')
  })
})
