import { createGoogleAIBogartProvider } from '@/server/adapters/bogart/google-ai-bogart-provider'
import { createInMemoryBogartRateLimiter } from '@/server/adapters/bogart/in-memory-bogart-rate-limiter'
import { createLocalBogartProvider } from '@/server/adapters/bogart/local-bogart-provider'
import { createBogartPostHandler } from '@/server/application/bogart/bogart-route-handler'
import type { AIExplanationProvider } from '@/server/ports/ai-explanation-provider'
import { fromNullable, matchMaybe } from '@/shared/fp'

export const dynamic = 'force-dynamic'

const aiProvider: AIExplanationProvider = matchMaybe<string, AIExplanationProvider>({
  none: () => createLocalBogartProvider(),
  some: (apiKey) => createGoogleAIBogartProvider({
    apiKey,
    model: 'gemini-2.5-flash',
    temperature: 0.15,
    maxOutputTokens: 1200,
  }),
})(fromNullable(process.env.GOOGLE_API_KEY))

export const POST = createBogartPostHandler(
  aiProvider,
  createInMemoryBogartRateLimiter(),
)
