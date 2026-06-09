import { createFrankfurterExchangeRateProvider } from '@/server/adapters/frankfurter/frankfurter-adapter'
import { createConvertPostHandler } from '@/server/application/conversion/convert-route-handler'

export const dynamic = 'force-dynamic'

export const POST = createConvertPostHandler(createFrankfurterExchangeRateProvider())
