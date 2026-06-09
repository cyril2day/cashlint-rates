import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/currencies/route'
import type { ApiResponseDto } from '@/shared/dto/api'
import type { CurrenciesResponseDto } from '@/shared/dto/currencies'
import { matchDtoTag } from '@/shared/fp'

const readCurrenciesResponse = async (response: Response): Promise<ApiResponseDto<CurrenciesResponseDto>> =>
  response.json().then((body: ApiResponseDto<CurrenciesResponseDto>) => body)

const expectCurrenciesData = (
  body: ApiResponseDto<CurrenciesResponseDto>,
): CurrenciesResponseDto =>
  matchDtoTag<ApiResponseDto<CurrenciesResponseDto>, CurrenciesResponseDto>({
    ApiFailure: (failureBody) => {
      throw new Error(`Expected ApiSuccess, got ${failureBody.error.code}`)
    },
    ApiSuccess: (successBody) => successBody.data,
  })(body)

describe('GET /api/currencies', () => {
  it('returns a standard API envelope with a static safe-list catalogue', async () => {
    const response = GET()
    const body = await readCurrenciesResponse(response)
    const data = expectCurrenciesData(body)

    expect(response.status).toBe(200)
    expect(body._tag).toBe('ApiSuccess')
    expect(data.catalogue.source).toBe('static-safe-list')
    expect(data.catalogue.currencies.map((currency) => currency.code)).toContain('USD')
  })
})
