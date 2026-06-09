import type { AnalyseRequestDto } from '@/shared/dto/analysis'
import { fromNullable, matchMaybe } from '@/shared/fp'

export type DateRangeChoice = '7D' | '30D' | '90D' | '1Y' | 'Custom'

export type CustomDateRangeInput = {
  readonly startDate: string
  readonly endDate: string
}

export const dateRangeChoices: ReadonlyArray<DateRangeChoice> = ['7D', '30D', '90D', '1Y', 'Custom']

export const dateRangeChoiceFromInput = (value: string): DateRangeChoice =>
  matchMaybe<DateRangeChoice, DateRangeChoice>({
    none: () => '30D',
    some: (choice) => choice,
  })(fromNullable(dateRangeChoices.find((choice) => choice === value)))

const requestByChoice: Readonly<Record<DateRangeChoice, (customRange: CustomDateRangeInput) => AnalyseRequestDto['dateRange']>> = {
  '1Y': () => ({ _tag: 'Preset', preset: '1Y' }),
  '30D': () => ({ _tag: 'Preset', preset: '30D' }),
  '7D': () => ({ _tag: 'Preset', preset: '7D' }),
  '90D': () => ({ _tag: 'Preset', preset: '90D' }),
  Custom: (customRange) => ({
    _tag: 'Custom',
    startDate: customRange.startDate,
    endDate: customRange.endDate,
  }),
}

export const toAnalyseRequest = (
  base: string,
  quote: string,
  dateRangeChoice: DateRangeChoice,
  customRange: CustomDateRangeInput,
): AnalyseRequestDto => ({
  base,
  quote,
  dateRange: requestByChoice[dateRangeChoice](customRange),
})
