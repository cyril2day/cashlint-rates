import { describe, expect, it, vi } from 'vitest'
import { createBogartPostHandler } from '@/server/application/bogart/bogart-route-handler'
import type { AIExplanationProvider } from '@/server/ports/ai-explanation-provider'
import type { BogartRateLimiter } from '@/server/ports/bogart-rate-limiter'
import type { ApiResponseDto } from '@/shared/dto/api'
import type { BogartResponseViewModelDto } from '@/shared/dto/bogart'
import { success } from '@/shared/fp'
import { pairAnalysisBogartContext } from '../../helpers/bogart-context'

const jsonRequest = (body: unknown): Request =>
  new Request('https://cashlint.test/api/bogart', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })

const limiter = (): BogartRateLimiter => ({
  consume: () => Promise.resolve(success({ tag: 'accepted', remaining: 9 })),
})

const provider = (): AIExplanationProvider => ({
  explain: vi.fn(() => Promise.resolve(success('Bogart is grounded in the current result.'))),
})

const readBogartResponse = async (response: Response): Promise<ApiResponseDto<BogartResponseViewModelDto>> =>
  response.json().then((body: ApiResponseDto<BogartResponseViewModelDto>) => body)

describe('POST /api/bogart', () => {
  it('returns an allowed answer in the standard API envelope', async () => {
    const response = await createBogartPostHandler(provider(), limiter())(
      jsonRequest({
        anonymousUserKey: 'user-1',
        context: pairAnalysisBogartContext(),
        question: 'Explain the latest rate',
      }),
    )
    const body = await readBogartResponse(response)

    expect(response.status).toBe(200)
    expect(body._tag).toBe('ApiSuccess')
  })

  it('returns refusal as a successful Bogart outcome', async () => {
    const aiProvider = provider()
    const response = await createBogartPostHandler(aiProvider, limiter())(
      jsonRequest({
        anonymousUserKey: 'user-1',
        context: pairAnalysisBogartContext(),
        question: 'Will USD go up next week?',
      }),
    )
    const body = await readBogartResponse(response)

    expect(response.status).toBe(200)
    expect(body._tag).toBe('ApiSuccess')
  })

  it('rejects invalid request shape before application service work', async () => {
    const response = await createBogartPostHandler(provider(), limiter())(
      jsonRequest({ question: '' }),
    )
    const body = await readBogartResponse(response)

    expect(response.status).toBe(400)
    expect(body._tag).toBe('ApiFailure')
  })
})
