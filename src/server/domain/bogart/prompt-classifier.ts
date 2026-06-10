import type { BogartRefusalReasonDto } from '@/shared/dto/bogart'
import { fromNullable, matchMaybe, type Maybe } from '@/shared/fp'

export type BogartPromptClassification =
  | {
      readonly tag: 'allowed'
    }
  | {
      readonly tag: 'refused'
      readonly reason: BogartRefusalReasonDto
    }

type ClassificationRule = {
  readonly reason: BogartRefusalReasonDto
  readonly pattern: RegExp
}

const refusalRules: ReadonlyArray<ClassificationRule> = [
  {
    reason: 'hidden-instructions',
    pattern: /\b(hidden|system|developer)\s+(prompt|instruction|message)s?\b|\bignore\s+(your|previous|all)\s+instructions?\b/i,
  },
  {
    reason: 'trading-strategy',
    pattern: /\b(strategy|trading|trade|scalp|arbitrage|hedg(e|ing))\b/i,
  },
  {
    reason: 'financial-advice',
    pattern: /\b(should\s+i|recommend|advice|advise|buy|sell|hold|exchange\s+now|convert\s+now)\b/i,
  },
  {
    reason: 'future-prediction',
    pattern: /\b(will|future|forecast|predict|next\s+(week|month|year)|tomorrow|go\s+up|go\s+down)\b/i,
  },
  {
    reason: 'probability-forecast',
    pattern: /\b(probability|odds|chance|likely|likelihood)\b/i,
  },
  {
    reason: 'good-rate',
    pattern: /\b(good|bad|best|worst)\s+rate\b/i,
  },
  {
    reason: 'out-of-scope',
    pattern: /\b(election|weather|sports|recipe|capital\s+of|joke|poem|song|movie)\b/i,
  },
]

const firstRefusalReason = (question: string): Maybe<BogartRefusalReasonDto> => {
  const match = refusalRules.find((rule) => rule.pattern.test(question))

  return matchMaybe<ClassificationRule, Maybe<BogartRefusalReasonDto>>({
    none: () => fromNullable(undefined),
    some: (rule) => fromNullable(rule.reason),
  })(fromNullable(match))
}

export const classifyBogartPrompt = (question: string): BogartPromptClassification =>
  matchMaybe<BogartRefusalReasonDto, BogartPromptClassification>({
    none: () => ({ tag: 'allowed' }),
    some: (reason) => ({ tag: 'refused', reason }),
  })(firstRefusalReason(question))
