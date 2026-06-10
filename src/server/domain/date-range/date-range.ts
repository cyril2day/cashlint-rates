import {
  booleanResult,
  chainResult,
  failure,
  fromNullable,
  liftResult2,
  mapResult,
  matchMaybe,
  matchTag,
  success,
  type Result,
} from '@/shared/fp'
import { addCalendarDays, isIsoDateBefore, isIsoDateOnOrBefore, isIsoDateString } from '@/shared/date'
import type { ISODateStringDto } from '@/shared/dto/api'

export type DateRangePreset = '7D' | '30D' | '90D' | '1Y'

export type DateRangeRequest =
  | {
      readonly tag: 'preset'
      readonly preset: DateRangePreset
    }
  | {
      readonly tag: 'custom'
      readonly startDate: string
      readonly endDate: string
    }

export type DateRangeRequestSource =
  | 'preset-7d'
  | 'preset-30d'
  | 'preset-90d'
  | 'preset-1y'
  | 'custom'

export type ResolvedDateRange = {
  readonly startDate: ISODateStringDto
  readonly endDate: ISODateStringDto
  readonly source: DateRangeRequestSource
}

export type DateRangeField = 'preset' | 'startDate' | 'endDate' | 'today'

export type DateRangeError =
  | {
      readonly tag: 'unsupported-preset'
      readonly field: 'preset'
      readonly candidate: string
      readonly message: string
    }
  | {
      readonly tag: 'invalid-date'
      readonly field: DateRangeField
      readonly value: string
      readonly message: string
    }
  | {
      readonly tag: 'invalid-date-range'
      readonly field: 'dateRange'
      readonly startDate: ISODateStringDto
      readonly endDate: ISODateStringDto
      readonly message: string
    }
  | {
      readonly tag: 'future-date'
      readonly field: 'startDate' | 'endDate'
      readonly value: ISODateStringDto
      readonly today: ISODateStringDto
      readonly message: string
    }

export const dateRangePresets: ReadonlyArray<DateRangePreset> = ['7D', '30D', '90D', '1Y']

export const friendlyPreviousToleranceDays = 5

const presetDays: Readonly<Record<DateRangePreset, number>> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  '1Y': 365,
}

const presetSources: Readonly<Record<DateRangePreset, DateRangeRequestSource>> = {
  '7D': 'preset-7d',
  '30D': 'preset-30d',
  '90D': 'preset-90d',
  '1Y': 'preset-1y',
}

const unsupportedPreset = (candidate: string): DateRangeError => ({
  tag: 'unsupported-preset',
  field: 'preset',
  candidate,
  message: `${candidate} is not a supported date-range preset.`,
})

const invalidDate = (field: DateRangeField, value: string): DateRangeError => ({
  tag: 'invalid-date',
  field,
  value,
  message: `${field} must be a real ISO date in YYYY-MM-DD format.`,
})

const invalidDateRange = (
  startDate: ISODateStringDto,
  endDate: ISODateStringDto,
): DateRangeError => ({
  tag: 'invalid-date-range',
  field: 'dateRange',
  startDate,
  endDate,
  message: 'Start date must be before end date.',
})

const futureDate = (
  field: 'startDate' | 'endDate',
  value: ISODateStringDto,
  today: ISODateStringDto,
): DateRangeError => ({
  tag: 'future-date',
  field,
  value,
  today,
  message: `${field} cannot be after today.`,
})

const parseIsoDate =
  (field: DateRangeField) =>
  (value: string): Result<DateRangeError, ISODateStringDto> =>
    booleanResult(isIsoDateString(value), invalidDate(field, value), value)

export const parseDateRangePreset = (candidate: string): Result<DateRangeError, DateRangePreset> => {
  const normalised = candidate.toUpperCase()
  const preset = dateRangePresets.find((value) => value === normalised)

  return matchMaybe<DateRangePreset, Result<DateRangeError, DateRangePreset>>({
    none: () => failure(unsupportedPreset(normalised)),
    some: success,
  })(fromNullable(preset))
}

export const presetDateRange = (preset: DateRangePreset): DateRangeRequest => ({
  tag: 'preset',
  preset,
})

export const customDateRange = (startDate: string, endDate: string): DateRangeRequest => ({
  tag: 'custom',
  startDate,
  endDate,
})

export const resolvePresetDateRange = (
  preset: DateRangePreset,
  today: ISODateStringDto,
): ResolvedDateRange => ({
  startDate: addCalendarDays(today, -presetDays[preset]),
  endDate: today,
  source: presetSources[preset],
})

type CustomDateRangeRequest = Extract<DateRangeRequest, { readonly tag: 'custom' }>

type ParsedCustomDateRange = {
  readonly startDate: ISODateStringDto
  readonly endDate: ISODateStringDto
}

const parsedCustomDateRange = (
  startDate: ISODateStringDto,
  endDate: ISODateStringDto,
): ParsedCustomDateRange => ({
  startDate,
  endDate,
})

const validateChronology = (
  range: ParsedCustomDateRange,
): Result<DateRangeError, ParsedCustomDateRange> =>
  booleanResult(
    isIsoDateBefore(range.startDate, range.endDate),
    invalidDateRange(range.startDate, range.endDate),
    range,
  )

const validateStartNotFuture =
  (today: ISODateStringDto) =>
  (range: ParsedCustomDateRange): Result<DateRangeError, ParsedCustomDateRange> =>
    booleanResult(
      isIsoDateOnOrBefore(range.startDate, today),
      futureDate('startDate', range.startDate, today),
      range,
    )

const validateEndNotFuture =
  (today: ISODateStringDto) =>
  (range: ParsedCustomDateRange): Result<DateRangeError, ParsedCustomDateRange> =>
    booleanResult(
      isIsoDateOnOrBefore(range.endDate, today),
      futureDate('endDate', range.endDate, today),
      range,
    )

const toResolvedCustomDateRange = (range: ParsedCustomDateRange): ResolvedDateRange => ({
  startDate: range.startDate,
  endDate: range.endDate,
  source: 'custom',
})

const resolveCustomDateRange = (
  request: CustomDateRangeRequest,
  today: ISODateStringDto,
): Result<DateRangeError, ResolvedDateRange> => {
  const parsedRange = liftResult2(parsedCustomDateRange)(
    parseIsoDate('startDate')(request.startDate),
    parseIsoDate('endDate')(request.endDate),
  )
  const chronologicalRange = chainResult<DateRangeError, ParsedCustomDateRange, ParsedCustomDateRange>(
    validateChronology,
  )(parsedRange)
  const startSafeRange = chainResult<DateRangeError, ParsedCustomDateRange, ParsedCustomDateRange>(
    validateStartNotFuture(today),
  )(chronologicalRange)
  const endSafeRange = chainResult<DateRangeError, ParsedCustomDateRange, ParsedCustomDateRange>(
    validateEndNotFuture(today),
  )(startSafeRange)

  return mapResult(toResolvedCustomDateRange)(endSafeRange)
}

const resolveValidDateRange = (
  request: DateRangeRequest,
  today: ISODateStringDto,
): Result<DateRangeError, ResolvedDateRange> =>
  matchTag<DateRangeRequest, Result<DateRangeError, ResolvedDateRange>>({
    custom: (customRequest) => resolveCustomDateRange(customRequest, today),
    preset: (presetRequest) => success(resolvePresetDateRange(presetRequest.preset, today)),
  })(request)

export const resolveDateRange = (
  request: DateRangeRequest,
  today: string,
): Result<DateRangeError, ResolvedDateRange> =>
  chainResult<DateRangeError, ISODateStringDto, ResolvedDateRange>((parsedToday) =>
    resolveValidDateRange(request, parsedToday),
  )(parseIsoDate('today')(today))
