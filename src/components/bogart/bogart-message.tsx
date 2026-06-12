'use client'

import type { ReactNode } from 'react'
import { formatDateTimeDateReadable } from '@/shared/date'
import type { ApiFailureDto } from '@/shared/dto/api'
import type { BogartResponseViewModelDto } from '@/shared/dto/bogart'
import { matchBoolean, matchDtoTag, matchTag } from '@/shared/fp'

export type BogartChatMessage =
  | {
      readonly tag: 'user'
      readonly question: string
    }
  | {
      readonly tag: 'failure'
      readonly error: ApiFailureDto['error']
    }
  | {
      readonly tag: 'response'
      readonly response: BogartResponseViewModelDto
    }

export const remainingText = (remaining: number): string =>
  matchBoolean<string>({
    false: () => `${remaining.toString()} Bogart questions left today.`,
    true: () => `${remaining.toString()} Bogart question left today.`,
  })(remaining === 1)

function BogartResponseMessage({
  response,
}: {
  readonly response: BogartResponseViewModelDto
}) {
  return matchDtoTag<BogartResponseViewModelDto, ReactNode>({
    BogartAnswer: (answer) => (
      <article className="bogart-message bogart-message--answer">
        <p>{answer.answer}</p>
        <span>{remainingText(answer.remainingQuestions)}</span>
      </article>
    ),
    BogartDailyLimitReached: (limit) => (
      <article className="bogart-message bogart-message--limit">
        <p>Daily question limit reached. Try again after {formatDateTimeDateReadable(limit.resetAt)}.</p>
      </article>
    ),
    BogartRefusal: (refusal) => (
      <article className="bogart-message bogart-message--refusal">
        <p>{refusal.message}</p>
        <span>{remainingText(refusal.remainingQuestions)}</span>
      </article>
    ),
    BogartUnavailable: (unavailable) => (
      <article className="bogart-message bogart-message--unavailable">
        <p>{unavailable.message}</p>
      </article>
    ),
  })(response)
}

export function BogartMessage({
  message,
}: {
  readonly message: BogartChatMessage
}) {
  return matchTag<BogartChatMessage, ReactNode>({
    failure: (failureMessage) => (
      <article className="bogart-message bogart-message--unavailable">
        <p>{failureMessage.error.message}</p>
      </article>
    ),
    response: (responseMessage) => (
      <BogartResponseMessage response={responseMessage.response} />
    ),
    user: (userMessage) => (
      <article className="bogart-message bogart-message--user">
        <p>{userMessage.question}</p>
      </article>
    ),
  })(message)
}
