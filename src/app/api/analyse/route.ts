import { createFrankfurterExchangeRateProvider } from '@/server/adapters/frankfurter/frankfurter-adapter'
import { createAnalysePostHandler } from '@/server/application/analysis/analyse-route-handler'

export const dynamic = 'force-dynamic'

export const POST = createAnalysePostHandler(createFrankfurterExchangeRateProvider())
