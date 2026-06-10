import type { BogartResultContextDto } from '@/shared/dto/bogart'
import type { AsyncResult } from '@/shared/fp'

export type AIExplanationProviderError = {
  readonly tag: 'ai-provider-unavailable'
  readonly message: string
}

export type AIExplanationInput = {
  readonly question: string
  readonly context: BogartResultContextDto
}

export interface AIExplanationProvider {
  explain(input: AIExplanationInput): AsyncResult<AIExplanationProviderError, string>
}
