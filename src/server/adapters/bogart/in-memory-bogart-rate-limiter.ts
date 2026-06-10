import type {
  BogartRateLimitInput,
  BogartRateLimiter,
  BogartRateLimitResult,
} from '@/server/ports/bogart-rate-limiter'
import { addCalendarDays } from '@/shared/date'
import { matchBoolean, success, type AsyncResult } from '@/shared/fp'

type LimitBucket = {
  readonly day: string
  readonly count: number
}

const buckets = new Map<string, LimitBucket>()

const bucketKey = (input: BogartRateLimitInput): string =>
  `${input.day}:${input.key}`

const resetAt = (day: string): string =>
  `${addCalendarDays(day, 1)}T00:00:00.000Z`

const nextResult = (
  input: BogartRateLimitInput,
  currentCount: number,
): BogartRateLimitResult => {
  const nextCount = currentCount + 1

  return matchBoolean<BogartRateLimitResult>({
    false: () => ({ tag: 'accepted', remaining: input.limit - nextCount }),
    true: () => ({ tag: 'exceeded', limit: input.limit, resetAt: resetAt(input.day) }),
  })(nextCount > input.limit)
}

const nextBucket = (
  input: BogartRateLimitInput,
  currentCount: number,
): LimitBucket => ({
  day: input.day,
  count: Math.min(currentCount + 1, input.limit),
})

export const createInMemoryBogartRateLimiter = (): BogartRateLimiter => ({
  consume: (input): AsyncResult<never, BogartRateLimitResult> => {
    const key = bucketKey(input)
    const bucket = buckets.get(key)
    const currentCount = bucket?.count ?? 0
    const result = nextResult(input, currentCount)

    buckets.set(key, nextBucket(input, currentCount))

    return Promise.resolve(success(result))
  },
})
