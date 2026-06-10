import { createInMemoryBogartRateLimiter } from '@/server/adapters/bogart/in-memory-bogart-rate-limiter'
import { createLocalBogartProvider } from '@/server/adapters/bogart/local-bogart-provider'
import { createBogartPostHandler } from '@/server/application/bogart/bogart-route-handler'

export const dynamic = 'force-dynamic'

export const POST = createBogartPostHandler(
  createLocalBogartProvider(),
  createInMemoryBogartRateLimiter(),
)
