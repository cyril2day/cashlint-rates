import { classifyBogartPrompt } from '@/server/domain/bogart/prompt-classifier'
import { refusalMessage } from '@/server/domain/bogart/refusals'
import type { AIExplanationProvider, AIExplanationProviderError } from '@/server/ports/ai-explanation-provider'
import type { BogartRateLimitError, BogartRateLimiter, BogartRateLimitResult } from '@/server/ports/bogart-rate-limiter'
import type {
  BogartRequestDto,
  BogartResponseViewModelDto,
  BogartResultContextDto,
} from '@/shared/dto/bogart'
import type { ISODateStringDto } from '@/shared/dto/api'
import {
  allTrue,
  booleanResult,
  chainResult,
  mapResult,
  matchBoolean,
  matchResult,
  matchTag,
  success,
  type AsyncResult,
  type Result,
} from '@/shared/fp'

const dailyLimit = 10

export type BogartError =
  | {
      readonly tag: 'invalid-json'
      readonly message: string
    }
  | {
      readonly tag: 'invalid-request-shape'
      readonly field: string
      readonly message: string
    }
  | {
      readonly tag: 'context-invalid'
      readonly message: string
    }
  | {
      readonly tag: 'rate-limit-state-unavailable'
      readonly message: string
    }
  | {
      readonly tag: 'provider-unavailable'
      readonly message: string
    }

export type BogartDependencies = {
  readonly aiProvider: AIExplanationProvider
  readonly rateLimiter: BogartRateLimiter
  readonly today: ISODateStringDto
}

const hasUsefulContext = (context: BogartResultContextDto): boolean =>
  allTrue([
    context.keyResults.length > 0,
    context.selectedCurrencies.base.length === 3,
    context.selectedCurrencies.quotes.length > 0,
  ])

const validateContext = (context: BogartResultContextDto): Result<BogartError, BogartResultContextDto> =>
  booleanResult(
    hasUsefulContext(context),
    {
      tag: 'context-invalid',
      message: 'Bogart needs a current Cashlint result context before answering.',
    },
    context,
  )

const mapLimiterError = (error: BogartRateLimitError): BogartError => ({
  tag: 'rate-limit-state-unavailable',
  message: error.message,
})

const consumeLimit = (
  deps: BogartDependencies,
  request: BogartRequestDto,
): AsyncResult<BogartError, BogartRateLimitResult> =>
  deps.rateLimiter
    .consume({
      day: deps.today,
      key: request.anonymousUserKey,
      limit: dailyLimit,
    })
    .then(matchResult<BogartRateLimitError, BogartRateLimitResult, Result<BogartError, BogartRateLimitResult>>({
      failure: (error) => ({ tag: 'failure', error: mapLimiterError(error) }),
      success,
    }))

const providerAnswer = (
  deps: BogartDependencies,
  request: BogartRequestDto,
  remainingQuestions: number,
): AsyncResult<BogartError, BogartResponseViewModelDto> =>
  deps.aiProvider
    .explain({ question: request.question, context: request.context })
    .then(matchResult<AIExplanationProviderError, string, Result<BogartError, BogartResponseViewModelDto>>({
      failure: () => success({
        _tag: 'BogartUnavailable',
        message: 'Explanation is not available at the moment.',
      }),
      success: (answer) => success({
        _tag: 'BogartAnswer',
        answer,
        remainingQuestions,
      }),
    }))

const classifiedResponse = (
  deps: BogartDependencies,
  request: BogartRequestDto,
  remainingQuestions: number,
): AsyncResult<BogartError, BogartResponseViewModelDto> =>
  matchTag<ReturnType<typeof classifyBogartPrompt>, AsyncResult<BogartError, BogartResponseViewModelDto>>({
    allowed: () => providerAnswer(deps, request, remainingQuestions),
    refused: (classification) => Promise.resolve(success({
      _tag: 'BogartRefusal',
      reason: classification.reason,
      message: refusalMessage(classification.reason),
      remainingQuestions,
    })),
  })(classifyBogartPrompt(request.question))

const limitedOrAnswer = (
  deps: BogartDependencies,
  request: BogartRequestDto,
): (limitResult: BogartRateLimitResult) => AsyncResult<BogartError, BogartResponseViewModelDto> =>
  matchTag<BogartRateLimitResult, AsyncResult<BogartError, BogartResponseViewModelDto>>({
    accepted: (accepted) => classifiedResponse(deps, request, accepted.remaining),
    exceeded: (exceeded) => Promise.resolve(success({
      _tag: 'BogartDailyLimitReached',
      limit: exceeded.limit,
      resetAt: exceeded.resetAt,
    })),
  })

export const askBogart =
  (deps: BogartDependencies) =>
  async (request: BogartRequestDto): AsyncResult<BogartError, BogartResponseViewModelDto> => {
    const contextResult = validateContext(request.context)
    const limitResult = await matchResult<BogartError, BogartResultContextDto, AsyncResult<BogartError, BogartRateLimitResult>>({
      failure: (error) => Promise.resolve({ tag: 'failure', error }),
      success: () => consumeLimit(deps, request),
    })(contextResult)

    return matchResult<BogartError, BogartRateLimitResult, AsyncResult<BogartError, BogartResponseViewModelDto>>({
      failure: (error) => Promise.resolve({ tag: 'failure', error }),
      success: limitedOrAnswer(deps, request),
    })(limitResult)
  }

export const validateBogartQuestion = (question: string): Result<BogartError, string> =>
  chainResult<BogartError, string, string>((trimmed) =>
    booleanResult(
      allTrue([trimmed.length > 0, trimmed.length <= 500]),
      {
        tag: 'invalid-request-shape',
        field: 'question',
        message: 'Question must be between 1 and 500 characters.',
      },
      trimmed,
    ),
  )(mapResult((value: string) => value.trim())(success(question)))

export const availableOrUnavailable = (result: Result<BogartError, BogartResponseViewModelDto>): BogartResponseViewModelDto =>
  matchResult<BogartError, BogartResponseViewModelDto, BogartResponseViewModelDto>({
    failure: (error) =>
      matchBoolean<BogartResponseViewModelDto>({
        false: () => ({
          _tag: 'BogartUnavailable',
          message: 'Explanation is not available at the moment.',
        }),
        true: () => ({
          _tag: 'BogartUnavailable',
          message: error.message,
        }),
      })(error.tag === 'context-invalid'),
    success: (value) => value,
  })(result)
