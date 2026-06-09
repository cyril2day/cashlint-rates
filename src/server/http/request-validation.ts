import {
  chainResult,
  allTrue,
  booleanResult,
  fromTypeGuard,
  isFalse,
  mapResult,
  sequenceResult,
  type Result,
} from '@/shared/fp'
import { decodeError, type DecodeError } from './decode-error'

export type JsonRecord = Readonly<Record<string, unknown>>

const validatedValue = <A, E>(
  predicate: boolean,
  value: A,
  error: E,
): Result<E, A> =>
  booleanResult(predicate, error, value)

const isFiniteNumber = (value: unknown): value is number =>
  allTrue([typeof value === 'number', Number.isFinite(value)])

const isString = (value: unknown): value is string => typeof value === 'string'

const isReadonlyUnknownArray = (value: unknown): value is ReadonlyArray<unknown> =>
  Array.isArray(value)

const isJsonRecord = (value: unknown): value is JsonRecord =>
  allTrue([
    typeof value === 'object',
    value !== null,
    isFalse(Array.isArray(value)),
  ])

// decodeString :: readonly string[] -> unknown -> Result<DecodeError, string>
export const decodeString =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, string> =>
    fromTypeGuard(isString, () => decodeError(path, 'a string', value))(value)

// decodeNonEmptyString :: readonly string[] -> unknown -> Result<DecodeError, string>
export const decodeNonEmptyString =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, string> =>
    chainResult<DecodeError, string, string>((text) =>
      validatedValue(text.trim().length > 0, text, decodeError(path, 'a non-empty string', value)),
    )(decodeString(path)(value))

// decodeFiniteNumber :: readonly string[] -> unknown -> Result<DecodeError, number>
export const decodeFiniteNumber =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, number> =>
    fromTypeGuard(isFiniteNumber, () => decodeError(path, 'a finite number', value))(value)

// decodePositiveFiniteNumber :: readonly string[] -> unknown -> Result<DecodeError, number>
export const decodePositiveFiniteNumber =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, number> =>
    chainResult<DecodeError, number, number>((amount) =>
      validatedValue(amount > 0, amount, decodeError(path, 'a positive finite number', value)),
    )(decodeFiniteNumber(path)(value))

// decodeIsoDateString :: readonly string[] -> unknown -> Result<DecodeError, string>
export const decodeIsoDateString =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, string> =>
    chainResult<DecodeError, string, string>((text) =>
      validatedValue(/^\d{4}-\d{2}-\d{2}$/.test(text), text, decodeError(path, 'YYYY-MM-DD', value)),
    )(decodeString(path)(value))

// decodeCurrencyCodeCandidate :: readonly string[] -> unknown -> Result<DecodeError, string>
export const decodeCurrencyCodeCandidate =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, string> =>
    mapResult((text: string) => text.toUpperCase())(
      chainResult<DecodeError, string, string>((text) =>
        validatedValue(/^[A-Za-z]{3}$/.test(text), text, decodeError(path, 'a 3-letter currency code', value)),
      )(decodeString(path)(value)),
    )

// decodeRecord :: readonly string[] -> unknown -> Result<DecodeError, JsonRecord>
export const decodeRecord =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, JsonRecord> =>
    fromTypeGuard(isJsonRecord, () => decodeError(path, 'an object', value))(value)

// decodeReadonlyArray :: readonly string[] -> (unknown -> Result<DecodeError, A>) -> unknown -> Result<DecodeError, readonly A[]>
export const decodeReadonlyArray =
  <A>(path: readonly string[], decodeItem: (item: unknown) => Result<DecodeError, A>) =>
  (value: unknown): Result<DecodeError, ReadonlyArray<A>> =>
    chainResult<DecodeError, ReadonlyArray<unknown>, ReadonlyArray<A>>((items) =>
      sequenceResult(items.map(decodeItem)),
    )(
      fromTypeGuard(isReadonlyUnknownArray, () => decodeError(path, 'an array', value))(value),
    )

export const readField =
  (field: string) =>
  (record: JsonRecord): unknown =>
    record[field]
