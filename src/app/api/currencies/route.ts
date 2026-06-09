import { getCurrencyCatalogue } from '@/server/application/currency-catalogue/get-currency-catalogue'
import { createRequestId, toJsonResponse } from '@/server/http/api-envelope'

export const dynamic = 'force-dynamic'

const createCurrencyCatalogueGetHandler =
  (): (() => Promise<Response>) =>
  async (): Promise<Response> =>
    toJsonResponse(createRequestId(), (error: never) => error)(await getCurrencyCatalogue())

export const GET = createCurrencyCatalogueGetHandler()
