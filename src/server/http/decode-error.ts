import type { ApiErrorDto } from '@/shared/dto/api'

export type DecodeError = {
  readonly tag: 'decode-error'
  readonly path: readonly string[]
  readonly expected: string
  readonly actual: string
  readonly message: string
}

export const describeUnknown = (value: unknown): string =>
  Object.prototype.toString.call(value).replace('[object ', '').replace(']', '').toLowerCase()

export const decodeError = (
  path: readonly string[],
  expected: string,
  actual: unknown,
): DecodeError => ({
  tag: 'decode-error',
  path,
  expected,
  actual: describeUnknown(actual),
  message: `${path.join('.') || 'value'} must be ${expected}.`,
})

export const decodeErrorToApiError = (error: DecodeError): ApiErrorDto => ({
  code: 'INVALID_REQUEST_SHAPE',
  category: 'validation',
  message: error.message,
  recoverable: true,
  fieldErrors: [
    {
      field: error.path.join('.') || 'body',
      code: error.expected,
      message: error.message,
    },
  ],
  details: [
    { key: 'expected', value: error.expected },
    { key: 'actual', value: error.actual },
  ],
})
