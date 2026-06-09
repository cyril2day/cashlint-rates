import {
  chainResult,
  failure,
  mapResult,
  sequenceResult,
  success,
  type Result,
} from '@/shared/fp'
import { decodeError, type DecodeError } from './decode-error'

export type JsonRecord = Readonly<Record<string, unknown>>

const booleanResult = <A, E>(
  predicate: boolean,
  value: A,
  error: E,
): Result<E, A> =>
  ({
    false: failure(error),
    true: success(value),
  })[String(predicate) as 'false' | 'true']

// decodeString :: readonly string[] -> unknown -> Result<DecodeError, string>
export const decodeString =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, string> =>
    booleanResult(typeof value === 'string', value as string, decodeError(path, 'a string', value))

// decodeNonEmptyString :: readonly string[] -> unknown -> Result<DecodeError, string>
export const decodeNonEmptyString =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, string> =>
    chainResult<DecodeError, string, string>((text) =>
      booleanResult(text.trim().length > 0, text, decodeError(path, 'a non-empty string', value)),
    )(decodeString(path)(value))

// decodeFiniteNumber :: readonly string[] -> unknown -> Result<DecodeError, number>
export const decodeFiniteNumber =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, number> =>
    booleanResult(
      typeof value === 'number' && Number.isFinite(value),
      value as number,
      decodeError(path, 'a finite number', value),
    )

// decodePositiveFiniteNumber :: readonly string[] -> unknown -> Result<DecodeError, number>
export const decodePositiveFiniteNumber =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, number> =>
    chainResult<DecodeError, number, number>((amount) =>
      booleanResult(amount > 0, amount, decodeError(path, 'a positive finite number', value)),
    )(decodeFiniteNumber(path)(value))

// decodeIsoDateString :: readonly string[] -> unknown -> Result<DecodeError, string>
export const decodeIsoDateString =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, string> =>
    chainResult<DecodeError, string, string>((text) =>
      booleanResult(/^\d{4}-\d{2}-\d{2}$/.test(text), text, decodeError(path, 'YYYY-MM-DD', value)),
    )(decodeString(path)(value))

// decodeCurrencyCodeCandidate :: readonly string[] -> unknown -> Result<DecodeError, string>
export const decodeCurrencyCodeCandidate =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, string> =>
    mapResult((text: string) => text.toUpperCase())(
      chainResult<DecodeError, string, string>((text) =>
        booleanResult(/^[A-Za-z]{3}$/.test(text), text, decodeError(path, 'a 3-letter currency code', value)),
      )(decodeString(path)(value)),
    )

// decodeRecord :: readonly string[] -> unknown -> Result<DecodeError, JsonRecord>
export const decodeRecord =
  (path: readonly string[]) =>
  (value: unknown): Result<DecodeError, JsonRecord> =>
    booleanResult(
      typeof value === 'object' && value !== null && !Array.isArray(value),
      value as JsonRecord,
      decodeError(path, 'an object', value),
    )

// decodeReadonlyArray :: readonly string[] -> (unknown -> Result<DecodeError, A>) -> unknown -> Result<DecodeError, readonly A[]>
export const decodeReadonlyArray =
  <A>(path: readonly string[], decodeItem: (item: unknown) => Result<DecodeError, A>) =>
  (value: unknown): Result<DecodeError, ReadonlyArray<A>> =>
    chainResult<DecodeError, ReadonlyArray<unknown>, ReadonlyArray<A>>((items) =>
      sequenceResult(items.map(decodeItem)),
    )(
      booleanResult(
        Array.isArray(value),
        value as ReadonlyArray<unknown>,
        decodeError(path, 'an array', value),
      ),
    )

export const readField =
  (field: string) =>
  (record: JsonRecord): unknown =>
    record[field]
