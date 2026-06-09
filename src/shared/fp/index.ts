export {
  always,
  allPass,
  anyPass,
  both,
  complement,
  cond,
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

type FailureResult<E> = { readonly tag: 'failure', readonly error: E }
type SuccessResult<A> = { readonly tag: 'success', readonly value: A }

type MaybeHandlers<A, B> = {
  readonly none: () => B
  readonly some: (value: A) => B
}

type SomeMaybe<A> = { readonly tag: 'some', readonly value: A }

// matchResult :: ResultHandlers<E, A, B> -> Result<E, A> -> B
export const matchResult =
  <E, A, B>(handlers: ResultHandlers<E, A, B>) =>
  (result: Result<E, A>): B =>
    ({
      failure: () => handlers.failure((result as FailureResult<E>).error),
      success: () => handlers.success((result as SuccessResult<A>).value),
    })[result.tag]()

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

// chainResult :: (A -> Result<E, B>) -> Result<E, A> -> Result<E, B>
export const chainResult =
  <E, A, B>(project: (value: A) => Result<E, B>) =>
  (result: Result<E, A>): Result<E, B> =>
    matchResult<E, A, Result<E, B>>({
      failure,
      success: project,
    })(result)

// matchMaybe :: MaybeHandlers<A, B> -> Maybe<A> -> B
export const matchMaybe =
  <A, B>(handlers: MaybeHandlers<A, B>) =>
  (maybe: Maybe<A>): B =>
    ({
      none: handlers.none,
      some: () => handlers.some((maybe as SomeMaybe<A>).value),
    })[maybe.tag]()

// foldMaybe :: B -> (A -> B) -> Maybe<A> -> B
export const foldMaybe =
  <A, B>(onNone: B, onSome: (value: A) => B) =>
  (maybe: Maybe<A>): B =>
    matchMaybe<A, B>({ none: () => onNone, some: onSome })(maybe)

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
    })[String(predicate(value)) as 'false' | 'true']

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
