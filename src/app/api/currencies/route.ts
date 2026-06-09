import { getCurrencyCatalogue } from '@/server/application/currency-catalogue/get-currency-catalogue'
import { createRequestId, toJsonResponse } from '@/server/http/api-envelope'

export const dynamic = 'force-dynamic'

export const GET = (): Response =>
  toJsonResponse(createRequestId(), (error: never) => error)(getCurrencyCatalogue())
