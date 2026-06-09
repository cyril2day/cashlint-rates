export type ContractVersionDto = '2026-06-09'
export type RequestIdDto = string
export type ISODateStringDto = string
export type ISODateTimeStringDto = string
export type CurrencyCodeDto = string

export type MaybeDto<A> =
  | { readonly _tag: 'Nothing' }
  | { readonly _tag: 'Just', readonly value: A }

export type ApiWarningSeverityDto = 'info' | 'warning'

export type ApiWarningDto = {
  readonly code: string
  readonly message: string
  readonly severity: ApiWarningSeverityDto
}

export type ApiErrorCategoryDto =
  | 'validation'
  | 'currency'
  | 'date-range'
  | 'provider'
  | 'data-quality'
  | 'calculation'
  | 'formula'
  | 'bogart'
  | 'rate-limit'
  | 'unexpected-boundary'

export type ApiErrorCodeDto =
  | 'INVALID_JSON'
  | 'INVALID_REQUEST_SHAPE'
  | 'INVALID_AMOUNT'
  | 'INVALID_CURRENCY_CODE'
  | 'UNSUPPORTED_CURRENCY'
  | 'INVALID_DATE_RANGE'
  | 'FUTURE_DATE_NOT_ALLOWED'
  | 'QUOTE_LIMIT_EXCEEDED'
  | 'DUPLICATE_QUOTE_CURRENCY'
  | 'NO_QUOTES_SELECTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_PAYLOAD_INVALID'
  | 'NO_OBSERVATIONS_FOUND'
  | 'INSUFFICIENT_OBSERVATIONS'
  | 'CALCULATION_UNAVAILABLE'
  | 'FORMULA_METADATA_MISSING'
  | 'BOGART_CONTEXT_INVALID'
  | 'BOGART_PROVIDER_UNAVAILABLE'
  | 'RATE_LIMIT_STATE_UNAVAILABLE'
  | 'UNEXPECTED_BOUNDARY_ERROR'

export type FieldErrorDto = {
  readonly field: string
  readonly code: string
  readonly message: string
}

export type ApiErrorDetailDto = {
  readonly key: string
  readonly value: string
}

export type ApiErrorDto = {
  readonly code: ApiErrorCodeDto
  readonly category: ApiErrorCategoryDto
  readonly message: string
  readonly recoverable: boolean
  readonly fieldErrors: ReadonlyArray<FieldErrorDto>
  readonly details: ReadonlyArray<ApiErrorDetailDto>
}

export type ApiSuccessDto<A> = {
  readonly _tag: 'ApiSuccess'
  readonly contractVersion: ContractVersionDto
  readonly requestId: RequestIdDto
  readonly data: A
  readonly warnings: ReadonlyArray<ApiWarningDto>
}

export type ApiFailureDto = {
  readonly _tag: 'ApiFailure'
  readonly contractVersion: ContractVersionDto
  readonly requestId: RequestIdDto
  readonly error: ApiErrorDto
  readonly warnings: ReadonlyArray<ApiWarningDto>
}

export type ApiResponseDto<A> = ApiSuccessDto<A> | ApiFailureDto

export type CurrencyDto = {
  readonly code: CurrencyCodeDto
  readonly name: string
  readonly symbol: MaybeDto<string>
}

export type CurrencySummaryDto = {
  readonly code: CurrencyCodeDto
  readonly name: string
}

export type AttributionDto = {
  readonly label: string
  readonly sourceName: string
  readonly sourceUrl: string
}
