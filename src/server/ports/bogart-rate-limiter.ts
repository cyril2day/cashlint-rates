import type { ISODateStringDto, ISODateTimeStringDto } from '@/shared/dto/api'
import type { AsyncResult } from '@/shared/fp'

export type BogartRateLimitInput = {
  readonly key: string
  readonly day: ISODateStringDto
  readonly limit: number
}

export type BogartRateLimitAccepted = {
  readonly tag: 'accepted'
  readonly remaining: number
}

export type BogartRateLimitExceeded = {
  readonly tag: 'exceeded'
  readonly limit: number
  readonly resetAt: ISODateTimeStringDto
}

export type BogartRateLimitResult =
  | BogartRateLimitAccepted
  | BogartRateLimitExceeded

export type BogartRateLimitError = {
  readonly tag: 'rate-limit-state-unavailable'
  readonly message: string
}

export interface BogartRateLimiter {
  consume(input: BogartRateLimitInput): AsyncResult<BogartRateLimitError, BogartRateLimitResult>
}
