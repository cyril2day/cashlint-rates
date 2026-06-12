import type { AIExplanationProvider } from '@/server/ports/ai-explanation-provider'
import type { BogartResultContextDto } from '@/shared/dto/bogart'
import { formatDateReadable } from '@/shared/date'
import { matchDtoTag } from '@/shared/fp'

const keyResultText = (context: BogartResultContextDto): string =>
  context.keyResults
    .map((result) => `${result.label}: ${result.value}`)
    .join('; ')

const dateRangeText = (context: BogartResultContextDto): string =>
  matchDtoTag<typeof context.selectedDateRange, string>({
    Just: (range) => `The effective period is ${formatDateReadable(range.value.startDate)} to ${formatDateReadable(range.value.endDate)}.`,
    Nothing: () => 'There is no selected historical period for this result.',
  })(context.selectedDateRange)

const chartText = (context: BogartResultContextDto): string =>
  matchDtoTag<typeof context.chartContext, string>({
    Just: (chart) =>
      `The visible chart is "${chart.value.title}", a ${chart.value.chartType}. ${chart.value.plainEnglishDescription} The x-axis is ${chart.value.xAxis} The y-axis is ${chart.value.yAxis}`,
    Nothing: () =>
      matchDtoTag<typeof context.chartSummary, string>({
        Just: (summary) => summary.value,
        Nothing: () => 'No chart is attached to this result.',
      })(context.chartSummary),
  })(context.chartContext)

const modeText: Readonly<Record<BogartResultContextDto['mode'], string>> = {
  comparison: 'comparison',
  conversion: 'conversion',
  'pair-analysis': 'pair analysis',
}

const answerFromContext = (
  question: string,
  context: BogartResultContextDto,
): string => [
  `This ${modeText[context.mode]} result is for ${context.selectedCurrencies.base} against ${context.selectedCurrencies.quotes.join(', ')}.`,
  dateRangeText(context),
  keyResultText(context),
  chartText(context),
  `For your question, "${question}", the safest reading is the one shown by these app-calculated values; Bogart does not add predictions or exchange advice.`,
].join(' ')

export const createLocalBogartProvider = (): AIExplanationProvider => ({
  explain: (input) => Promise.resolve({
    tag: 'success',
    value: answerFromContext(input.question, input.context),
  }),
})
