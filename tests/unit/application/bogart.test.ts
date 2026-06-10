import { describe, expect, it, vi } from 'vitest'
import { askBogart } from '@/server/application/bogart/bogart'
import type { AIExplanationProvider } from '@/server/ports/ai-explanation-provider'
import type { BogartRateLimiter } from '@/server/ports/bogart-rate-limiter'
import { success } from '@/shared/fp'
import { pairAnalysisBogartContext } from '../../helpers/bogart-context'

const acceptedLimiter = (remaining: number): BogartRateLimiter => ({
  consume: () => Promise.resolve(success({ tag: 'accepted', remaining })),
})

const exceededLimiter = (): BogartRateLimiter => ({
  consume: () => Promise.resolve(success({
    tag: 'exceeded',
    limit: 10,
    resetAt: '2026-06-11T00:00:00.000Z',
  })),
})

const providerWithAnswer = (answer: string): AIExplanationProvider => ({
  explain: () => Promise.resolve(success(answer)),
})

describe('askBogart', () => {
  it('answers allowed questions through the provider', async () => {
    const provider = {
      explain: vi.fn(() => Promise.resolve(success('The latest rate is the final cleaned observation.'))),
    }
    const result = await askBogart({
      aiProvider: provider,
      rateLimiter: acceptedLimiter(9),
      today: '2026-06-10',
    })({
      anonymousUserKey: 'user-1',
      context: pairAnalysisBogartContext(),
      question: 'Explain the latest rate',
    })

    expect(result).toEqual(success({
      _tag: 'BogartAnswer',
      answer: 'The latest rate is the final cleaned observation.',
      remainingQuestions: 9,
    }))
    expect(provider.explain).toHaveBeenCalledTimes(1)
  })

  it('refuses disallowed prompts without provider access', async () => {
    const provider = {
      explain: vi.fn(() => Promise.resolve(success('unused'))),
    }
    const result = await askBogart({
      aiProvider: provider,
      rateLimiter: acceptedLimiter(8),
      today: '2026-06-10',
    })({
      anonymousUserKey: 'user-1',
      context: pairAnalysisBogartContext(),
      question: 'Should I exchange money today?',
    })

    expect(result.tag).toBe('success')
    expect(provider.explain).not.toHaveBeenCalled()
  })

  it('returns the daily-limit view model before provider access', async () => {
    const provider = providerWithAnswer('unused')
    const result = await askBogart({
      aiProvider: provider,
      rateLimiter: exceededLimiter(),
      today: '2026-06-10',
    })({
      anonymousUserKey: 'user-1',
      context: pairAnalysisBogartContext(),
      question: 'Explain period movement',
    })

    expect(result).toEqual(success({
      _tag: 'BogartDailyLimitReached',
      limit: 10,
      resetAt: '2026-06-11T00:00:00.000Z',
    }))
  })
})
