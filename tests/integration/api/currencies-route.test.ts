import { describe, expect, it } from 'vitest'
import {
  createInMemoryCurrencyCatalogueCache,
  getCurrencyCatalogue,
  type CurrencyCatalogueDeps,
} from '@/server/application/currency-catalogue/get-currency-catalogue'
import type { ApiResponseDto } from '@/shared/dto/api'
import type { CurrenciesResponseDto } from '@/shared/dto/currencies'
import { matchDtoTag } from '@/shared/fp'
import { failingRateProvider, fakeCurrencyCatalogue, successfulRateProvider } from '../../helpers/fake-rate-provider'

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

const responseFromDeps = async (deps: CurrencyCatalogueDeps): Promise<Response> =>
  Response.json(
    {
      _tag: 'ApiSuccess',
      contractVersion: '2026-06-09',
      requestId: 'test',
      data: await getCurrencyCatalogue(deps).then((result) =>
        result.tag === 'success'
          ? result.value
          : (() => {
              throw new Error('Unexpected catalogue failure')
            })()
      ),
      warnings: [],
    },
    { status: 200 },
  )

describe('GET /api/currencies', () => {
  it('returns provider catalogue data when Frankfurter is available', async () => {
    const response = await responseFromDeps({
      provider: successfulRateProvider(),
      cache: createInMemoryCurrencyCatalogueCache(),
    })
    const body = await readCurrenciesResponse(response)
    const data = expectCurrenciesData(body)

    expect(response.status).toBe(200)
    expect(data.catalogue.source).toBe('provider')
    expect(data.catalogue.retrievedAt).toEqual({ _tag: 'Just', value: '2026-06-09T00:00:00.000Z' })
    expect(data.catalogue.currencies.map((currency) => currency.code)).toContain('USD')
  })

  it('falls back to a stale cached catalogue when the provider is unavailable', async () => {
    const cache = createInMemoryCurrencyCatalogueCache()
    const provider = successfulRateProvider(undefined, undefined, fakeCurrencyCatalogue({
      retrievedAt: '2026-06-08T00:00:00.000Z',
    }))

    await getCurrencyCatalogue({ provider, cache })

    const response = await responseFromDeps({
      provider: failingRateProvider({ tag: 'network', message: 'offline' }),
      cache,
    })
    const data = expectCurrenciesData(await readCurrenciesResponse(response))

    expect(data.catalogue.source).toBe('stale-cache')
    expect(data.catalogue.retrievedAt).toEqual({ _tag: 'Just', value: '2026-06-08T00:00:00.000Z' })
  })

  it('falls back to the static safe list when provider and cache are unavailable', async () => {
    const response = await responseFromDeps({
      provider: failingRateProvider({ tag: 'network', message: 'offline' }),
      cache: createInMemoryCurrencyCatalogueCache(),
    })
    const data = expectCurrenciesData(await readCurrenciesResponse(response))

    expect(data.catalogue.source).toBe('static-safe-list')
    expect(data.catalogue.retrievedAt).toEqual({ _tag: 'Nothing' })
    expect(data.catalogue.currencies.map((currency) => currency.code)).toContain('USD')
  })
})
