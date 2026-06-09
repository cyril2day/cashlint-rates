import { addDays, compareAsc, format, isValid, parseISO } from 'date-fns'
import type { ISODateStringDto } from '@/shared/dto/api'

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

const toDate = (date: ISODateStringDto) => parseISO(date)

const normaliseIsoDate = (date: Date): ISODateStringDto =>
  format(date, 'yyyy-MM-dd')

export const isIsoDateString = (value: string): boolean => {
  const parsed = parseISO(value)

  return isoDatePattern.test(value) && isValid(parsed) && normaliseIsoDate(parsed) === value
}

export const addCalendarDays = (
  date: ISODateStringDto,
  days: number,
): ISODateStringDto =>
  normaliseIsoDate(addDays(toDate(date), days))

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
