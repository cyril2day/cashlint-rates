import { addDays, compareAsc, format, isValid, parseISO } from 'date-fns'
import type { ISODateStringDto, ISODateTimeStringDto } from '@/shared/dto/api'
import { matchBoolean } from '@/shared/fp'

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

const toDate = (date: ISODateStringDto) => parseISO(date)

const normaliseIsoDate = (date: Date): ISODateStringDto =>
  format(date, 'yyyy-MM-dd')

export const isIsoDateString = (value: string): boolean => {
  const parsed = parseISO(value)

  return matchBoolean<boolean>({
    false: () => false,
    true: () =>
      matchBoolean<boolean>({
        false: () => false,
        true: () => normaliseIsoDate(parsed) === value,
      })(isValid(parsed)),
  })(isoDatePattern.test(value))
}

export const addCalendarDays = (
  date: ISODateStringDto,
  days: number,
): ISODateStringDto =>
  normaliseIsoDate(addDays(toDate(date), days))

export const formatDateReadable = (date: ISODateStringDto): string =>
  format(toDate(date), 'MMMM d, yyyy')

const isoDateTimeDatePart = (dateTime: ISODateTimeStringDto): ISODateStringDto =>
  dateTime.slice(0, 10)

export const formatDateTimeDateReadable = (dateTime: ISODateTimeStringDto): string =>
  formatDateReadable(isoDateTimeDatePart(dateTime))

export const isIsoDateBefore = (
  left: ISODateStringDto,
  right: ISODateStringDto,
): boolean =>
  compareAsc(toDate(left), toDate(right)) < 0

export const isIsoDateOnOrBefore = (
  left: ISODateStringDto,
  right: ISODateStringDto,
): boolean =>
  compareAsc(toDate(left), toDate(right)) <= 0

export const currentIsoDate = (): ISODateStringDto =>
  normaliseIsoDate(new Date())
