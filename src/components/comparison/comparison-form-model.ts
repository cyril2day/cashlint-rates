import type { CompareRequestDto } from '@/shared/dto/comparison'
import type { CustomDateRangeInput, DateRangeChoice } from '@/components/analysis/analysis-form-model'

const requestByChoice: Readonly<Record<DateRangeChoice, (customRange: CustomDateRangeInput) => CompareRequestDto['dateRange']>> = {
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

export const toCompareRequest = (
  base: string,
  quotes: ReadonlyArray<string>,
  dateRangeChoice: DateRangeChoice,
  customRange: CustomDateRangeInput,
): CompareRequestDto => ({
  base,
  quotes,
  dateRange: requestByChoice[dateRangeChoice](customRange),
})
