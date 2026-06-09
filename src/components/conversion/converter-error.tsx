'use client'

import type { ApiFailureDto } from '@/shared/dto/api'

type ConverterErrorProps = {
  readonly error: ApiFailureDto['error']
}

const titleByCode: Readonly<Record<ApiFailureDto['error']['code'], string>> = {
  BOGART_CONTEXT_INVALID: 'Bogart context unavailable',
  BOGART_PROVIDER_UNAVAILABLE: 'Bogart unavailable',
  CALCULATION_UNAVAILABLE: 'Calculation unavailable',
  DUPLICATE_QUOTE_CURRENCY: 'Duplicate currency',
  FORMULA_METADATA_MISSING: 'Formula unavailable',
  FUTURE_DATE_NOT_ALLOWED: 'Future date blocked',
  INSUFFICIENT_OBSERVATIONS: 'Insufficient observations',
  INVALID_AMOUNT: 'Invalid amount',
  INVALID_CURRENCY_CODE: 'Invalid currency',
  INVALID_DATE_RANGE: 'Invalid date range',
  INVALID_JSON: 'Invalid request',
  INVALID_REQUEST_SHAPE: 'Invalid request',
  NO_OBSERVATIONS_FOUND: 'No observations found',
  NO_QUOTES_SELECTED: 'No quotes selected',
  PROVIDER_PAYLOAD_INVALID: 'Provider payload invalid',
  PROVIDER_UNAVAILABLE: 'Provider unavailable',
  QUOTE_LIMIT_EXCEEDED: 'Quote limit exceeded',
  RATE_LIMIT_STATE_UNAVAILABLE: 'Rate limit unavailable',
  UNEXPECTED_BOUNDARY_ERROR: 'Unexpected error',
  UNSUPPORTED_CURRENCY: 'Unsupported currency',
}

export function ConverterError({ error }: ConverterErrorProps) {
  return (
    <div className="converter-card__message converter-card__message--error" role="alert">
      <strong>{titleByCode[error.code]}</strong>
      <p>{error.message}</p>
    </div>
  )
}
