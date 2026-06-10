import { createFrankfurterExchangeRateProvider } from '@/server/adapters/frankfurter/frankfurter-adapter'
import { createComparePostHandler } from '@/server/application/comparison/compare-route-handler'

export const dynamic = 'force-dynamic'

export const POST = createComparePostHandler(createFrankfurterExchangeRateProvider())
