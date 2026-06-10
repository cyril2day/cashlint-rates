export {
  always,
  allPass,
  anyPass,
  both,
  complement,
  cond,
  curry,
  either,
  filter,
  identity,
  ifElse,
  map,
  pipe,
  reduce,
  unless,
  when,
} from 'ramda'

export type Result<E, A> =
  | { readonly tag: 'failure', readonly error: E }
  | { readonly tag: 'success', readonly value: A }

export type Maybe<A> =
  | { readonly tag: 'none' }
  | { readonly tag: 'some', readonly value: A }

export type AsyncResult<E, A> = Promise<Result<E, A>>

export const success = <A>(value: A): Result<never, A> => ({
  tag: 'success',
  value,
})

export const failure = <E>(error: E): Result<E, never> => ({
  tag: 'failure',
  error,
})

export const some = <A>(value: A): Maybe<A> => ({
  tag: 'some',
  value,
})

export const none = <A = never>(): Maybe<A> => ({
  tag: 'none',
})

type ResultHandlers<E, A, B> = {
  readonly failure: (error: E) => B
  readonly success: (value: A) => B
}

type MaybeHandlers<A, B> = {
  readonly none: () => B
  readonly some: (value: A) => B
}

type TagHandlers<U extends { readonly tag: string }, A> = {
  readonly [K in U['tag']]: (value: Extract<U, { readonly tag: K }>) => A
}

type DtoTagHandlers<U extends { readonly _tag: string }, A> = {
  readonly [K in U['_tag']]: (value: Extract<U, { readonly _tag: K }>) => A
}

// matchResult :: ResultHandlers<E, A, B> -> Result<E, A> -> B
export const matchResult =
  <E, A, B>(handlers: ResultHandlers<E, A, B>) =>
  (result: Result<E, A>): B => {
    if (result.tag === 'failure') {
      return handlers.failure(result.error)
    }

    return handlers.success(result.value)
  }

// foldResult :: (E -> B) -> (A -> B) -> Result<E, A> -> B
export const foldResult =
  <E, A, B>(onFailure: (error: E) => B, onSuccess: (value: A) => B) =>
  (result: Result<E, A>): B =>
    matchResult({ failure: onFailure, success: onSuccess })(result)

// mapResult :: (A -> B) -> Result<E, A> -> Result<E, B>
export const mapResult =
  <A, B>(project: (value: A) => B) =>
  <E>(result: Result<E, A>): Result<E, B> =>
    matchResult<E, A, Result<E, B>>({
      failure,
      success: (value) => success(project(value)),
    })(result)

// mapFailure :: (E1 -> E2) -> Result<E1, A> -> Result<E2, A>
export const mapFailure =
  <E1, E2>(project: (error: E1) => E2) =>
  <A>(result: Result<E1, A>): Result<E2, A> =>
    matchResult<E1, A, Result<E2, A>>({
      failure: (error) => failure(project(error)),
      success: (value) => success(value),
    })(result)

// chainResult :: (A -> Result<E, B>) -> Result<E, A> -> Result<E, B>
export const chainResult =
  <E, A, B>(project: (value: A) => Result<E, B>) =>
  (result: Result<E, A>): Result<E, B> =>
    matchResult<E, A, Result<E, B>>({
      failure,
      success: project,
    })(result)

// booleanResult :: boolean -> E -> A -> Result<E, A>
export const booleanResult = <E, A>(
  predicate: boolean,
  error: E,
  value: A,
): Result<E, A> =>
  ({
    false: failure(error),
    true: success(value),
  })[booleanKey(predicate)]

// lazyBooleanResult :: boolean -> (() -> E) -> (() -> A) -> Result<E, A>
export const lazyBooleanResult = <E, A>(
  predicate: boolean,
  onFalse: () => E,
  onTrue: () => A,
): Result<E, A> =>
  ({
    false: () => failure(onFalse()),
    true: () => success(onTrue()),
  })[booleanKey(predicate)]()

export type BooleanKey = 'false' | 'true'

export const booleanKey = (value: boolean): BooleanKey => {
  if (value) {
    return 'true'
  }

  return 'false'
}

export const matchBoolean =
  <A>(handlers: Readonly<Record<BooleanKey, () => A>>) =>
  (value: boolean): A =>
    handlers[booleanKey(value)]()

export const matchTag =
  <U extends { readonly tag: string }, A>(handlers: TagHandlers<U, A>) =>
  (value: U): A =>
    handlers[value.tag as U['tag']](value as never)

export const matchDtoTag =
  <U extends { readonly _tag: string }, A>(handlers: DtoTagHandlers<U, A>) =>
  (value: U): A =>
    handlers[value._tag as U['_tag']](value as never)

export const isFalse = (value: boolean): boolean =>
  matchBoolean({
    false: () => true,
    true: () => false,
  })(value)

export const allTrue = (values: ReadonlyArray<boolean>): boolean =>
  values.every((value) => value)

export const anyTrue = (values: ReadonlyArray<boolean>): boolean =>
  values.some((value) => value)

// apResult :: Result<E, (A -> B)> -> Result<E, A> -> Result<E, B>
const apResult = <E, A, B>(
  resultFn: Result<E, (a: A) => B>,
): ((resultA: Result<E, A>) => Result<E, B>) =>
  matchResult<E, (a: A) => B, (resultA: Result<E, A>) => Result<E, B>>({
    failure: (error) => () => failure(error),
    success: (fn) => (resultA) => mapResult<A, B>(fn)(resultA),
  })(resultFn)

// liftResult2 :: (A -> B -> C) -> Result<E, A> -> Result<E, B> -> Result<E, C>
export const liftResult2 =
  <A, B, C>(combine: (first: A, second: B) => C) =>
  <E>(first: Result<E, A>, second: Result<E, B>): Result<E, C> =>
    apResult(mapResult((a: A) => (b: B) => combine(a, b))(first))(second)

// liftResult3 :: (A -> B -> C -> D) -> Result<E, A> -> Result<E, B> -> Result<E, C> -> Result<E, D>
export const liftResult3 =
  <A, B, C, D>(combine: (first: A, second: B, third: C) => D) =>
  <E>(
    first: Result<E, A>,
    second: Result<E, B>,
    third: Result<E, C>,
  ): Result<E, D> =>
    apResult(
      apResult(mapResult((a: A) => (b: B) => (c: C) => combine(a, b, c))(first))(second),
    )(third)

// liftResult4 :: (A -> B -> C -> D -> X) -> Result<E, A> -> Result<E, B> -> Result<E, C> -> Result<E, D> -> Result<E, X>
export const liftResult4 =
  <A, B, C, D, X>(combine: (first: A, second: B, third: C, fourth: D) => X) =>
  <E>(
    first: Result<E, A>,
    second: Result<E, B>,
    third: Result<E, C>,
    fourth: Result<E, D>,
  ): Result<E, X> =>
    apResult(
      apResult(
        apResult(mapResult((a: A) => (b: B) => (c: C) => (d: D) => combine(a, b, c, d))(first))(second),
      )(third),
    )(fourth)

// matchMaybe :: MaybeHandlers<A, B> -> Maybe<A> -> B
export const matchMaybe =
  <A, B>(handlers: MaybeHandlers<A, B>) =>
  (maybe: Maybe<A>): B => {
    if (maybe.tag === 'none') {
      return handlers.none()
    }

    return handlers.some(maybe.value)
  }

// fromNullable :: (A | null | undefined) -> Maybe<NonNullable<A>>
export const fromNullable = <A>(value: A | null | undefined): Maybe<NonNullable<A>> => {
  if (value === null || value === undefined) {
    return none()
  }

  return some(value)
}

// isDefined :: (A | undefined) -> boolean  (type guard: narrows to A)
export const isDefined = <A>(value: A | undefined): value is A =>
  value !== undefined

// foldMaybe :: B -> (A -> B) -> Maybe<A> -> B
export const foldMaybe =
  <A, B>(onNone: B, onSome: (value: A) => B) =>
  (maybe: Maybe<A>): B =>
    matchMaybe<A, B>({ none: () => onNone, some: onSome })(maybe)

// withDefault :: A -> Maybe<A> -> A
export const withDefault =
  <A>(defaultValue: A) =>
  (maybe: Maybe<A>): A =>
    matchMaybe<A, A>({ none: () => defaultValue, some: (value) => value })(maybe)

// maybeToArray :: Maybe<A> -> ReadonlyArray<A>
export const maybeToArray = <A>(maybe: Maybe<A>): ReadonlyArray<A> =>
  matchMaybe<A, ReadonlyArray<A>>({
    none: () => [],
    some: (value) => [value],
  })(maybe)

// mapMaybe :: (A -> B) -> Maybe<A> -> Maybe<B>
export const mapMaybe =
  <A, B>(project: (value: A) => B) =>
  (maybe: Maybe<A>): Maybe<B> =>
    matchMaybe<A, Maybe<B>>({
      none,
      some: (value) => some(project(value)),
    })(maybe)

// chainMaybe :: (A -> Maybe<B>) -> Maybe<A> -> Maybe<B>
export const chainMaybe =
  <A, B>(project: (value: A) => Maybe<B>) =>
  (maybe: Maybe<A>): Maybe<B> =>
    matchMaybe<A, Maybe<B>>({
      none,
      some: project,
    })(maybe)

// fromPredicate :: (A -> boolean) -> E -> A -> Result<E, A>
export const fromPredicate =
  <E, A>(predicate: (value: A) => boolean, error: E) =>
  (value: A): Result<E, A> =>
    ({
      false: failure(error),
      true: success(value),
    })[booleanKey(predicate(value))]

// fromTypeGuard :: (unknown -> value is A) -> (unknown -> E) -> unknown -> Result<E, A>
export const fromTypeGuard =
  <E, A>(predicate: (value: unknown) => value is A, error: (value: unknown) => E) =>
  (value: unknown): Result<E, A> => {
    if (predicate(value)) {
      return success(value)
    }

    return failure(error(value))
  }

// sequenceResult :: ReadonlyArray<Result<E, A>> -> Result<E, ReadonlyArray<A>>
export const sequenceResult = <E, A>(
  results: ReadonlyArray<Result<E, A>>,
): Result<E, ReadonlyArray<A>> =>
  results.reduce<Result<E, ReadonlyArray<A>>>(
    (collected, current) =>
      chainResult<E, ReadonlyArray<A>, ReadonlyArray<A>>((values) =>
        mapResult<A, ReadonlyArray<A>>((value) => [...values, value])(current),
      )(collected),
    success([]),
  )

// traverseResult :: (A -> Result<E, B>) -> ReadonlyArray<A> -> Result<E, ReadonlyArray<B>>
export const traverseResult =
  <E, A, B>(project: (value: A) => Result<E, B>) =>
  (values: ReadonlyArray<A>): Result<E, ReadonlyArray<B>> =>
    sequenceResult(values.map(project))

// mapAsyncResult :: (A -> B) -> AsyncResult<E, A> -> AsyncResult<E, B>
export const mapAsyncResult =
  <A, B>(project: (value: A) => B) =>
  async <E>(result: AsyncResult<E, A>): AsyncResult<E, B> =>
    mapResult(project)(await result)

// chainAsyncResult :: (A -> AsyncResult<E, B>) -> AsyncResult<E, A> -> AsyncResult<E, B>
export const chainAsyncResult =
  <E, A, B>(project: (value: A) => AsyncResult<E, B>) =>
  async (result: AsyncResult<E, A>): AsyncResult<E, B> =>
    matchResult<E, A, AsyncResult<E, B>>({
      failure: (error) => Promise.resolve(failure(error)),
      success: project,
    })(await result)

// fromThrowable :: (() -> A) -> (unknown -> E) -> Result<E, A>
export const fromThrowable =
  <E, A>(effect: () => A, onError: (error: unknown) => E): Result<E, A> => {
    try {
      return success(effect())
    } catch (error: unknown) {
      return failure(onError(error))
    }
  }
