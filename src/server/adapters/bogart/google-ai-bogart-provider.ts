import { GoogleGenAI } from '@google/genai'
import type { AIExplanationInput, AIExplanationProvider, AIExplanationProviderError } from '@/server/ports/ai-explanation-provider'
import type { BogartResultContextDto } from '@/shared/dto/bogart'
import type { FormulaSummary } from '@/server/domain/formulas/formula-registry'
import { failure, fromNullable, matchBoolean, matchDtoTag, matchMaybe, success, type AsyncResult } from '@/shared/fp'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type GoogleAIBogartConfig = Readonly<{
  apiKey: string
  model: string
  temperature: number
  maxOutputTokens: number
}>

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const systemPrompt = [
  'You are Bogart, a specialised exchange-rate explanation assistant inside Cashlint Rates.',
  '',
  'RULES (follow strictly):',
  '1. Only explain the exchange-rate data and calculations currently shown to the user, in an elaborative way.',
  '2. Never provide financial advice, trading strategies, or recommend whether to buy, sell, hold, or exchange currency.',
  '3. Never predict, forecast, or speculate about future exchange rates or future market movement.',
  '4. Never give probability estimates, odds, or likelihood statements about future rates.',
  '5. Never say whether a rate is good, bad, best, or worst.',
  '6. If the user asks about anything outside the displayed result, politely decline and redirect to the shown data.',
  '7. Be concise. Answer in plain English. Prefer 2-5 sentences.',
  '8. Reference specific values from the data shown when they help the explanation.',
  '9. Use the mode label (conversion, pair analysis, comparison) to frame your answer.',
  '10. When discussing movement, always ground it in the observed historical period shown.',
].join('\n')

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const modeLabel: Readonly<Record<BogartResultContextDto['mode'], string>> = {
  comparison: 'comparison',
  conversion: 'conversion',
  'pair-analysis': 'pair analysis',
}

const dateRangeLine = (context: BogartResultContextDto): string =>
  matchDtoTag<typeof context.selectedDateRange, string>({
    Just: (range) =>
      `Effective period: ${range.value.startDate} to ${range.value.endDate}.`,
    Nothing: () =>
      'No historical period is selected for this result.',
  })(context.selectedDateRange)

const keyResultsLines = (context: BogartResultContextDto): string =>
  context.keyResults
    .map((r) => `• ${r.label}: ${r.value}`)
    .join('\n')

const chartLine = (context: BogartResultContextDto): string =>
  matchDtoTag<typeof context.chartSummary, string>({
    Just: (summary) => `Chart summary: ${summary.value}`,
    Nothing: () => '',
  })(context.chartSummary)

// dataQualityStatus is common to both pair-analysis and comparison computedStats.
// The conversion mode has MaybeDto<never> (perpetually Nothing), so the union
// narrowed through matchDtoTag on computedStats yields a Just value type of
// { dataQualityStatus: string; observationCount: number }
//   | { dataQualityStatus: string; rankableQuoteCount: number }
// and dataQualityStatus is accessible on both.
const statsLineForMode = (context: BogartResultContextDto): string =>
  matchDtoTag<typeof context.computedStats, string>({
    Just: (stats) =>
      `Data quality: ${stats.value.dataQualityStatus}.`,
    Nothing: () => '',
  })(context.computedStats)

const formulaSummaryLine = (f: FormulaSummary): string =>
  `• ${f.title}: ${f.summary}`

const formulaBlock = (context: BogartResultContextDto): string => {
  const lines = context.formulaSummaries.map(formulaSummaryLine)

  return matchBoolean<string>({
    false: () => '',
    true: () => ['', 'Formula summaries:', ...lines].join('\n'),
  })(lines.length > 0)
}

const disclaimerBlock = (context: BogartResultContextDto): string => {
  const lines = context.appDisclaimers.map((d) => `• ${d}`)

  return matchBoolean<string>({
    false: () => '',
    true: () => ['', 'Disclaimers:', ...lines].join('\n'),
  })(lines.length > 0)
}

const promptBlocks = (input: AIExplanationInput): ReadonlyArray<string> => {
  const c = input.context

  return [
    `Mode: ${modeLabel[c.mode]}`,
    `Currencies: ${c.selectedCurrencies.base} against ${c.selectedCurrencies.quotes.join(', ')}`,
    dateRangeLine(c),
    statsLineForMode(c),
    '',
    'Key results:',
    keyResultsLines(c),
    chartLine(c),
    formulaBlock(c),
    disclaimerBlock(c),
    '',
    `User question: "${input.question}"`,
    '',
    'Answer concisely based only on the data shown above.',
  ]
}

const buildPrompt = (input: AIExplanationInput): string =>
  promptBlocks(input)
    .filter((block) => block.length > 0)
    .join('\n')

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

const providerUnavailable = (): AIExplanationProviderError => ({
  tag: 'ai-provider-unavailable',
  message: 'Google AI request failed.',
})

const tryCatch = async <A>(
  task: () => Promise<A>,
): AsyncResult<AIExplanationProviderError, A> => {
  try {
    return success(await task())
  } catch {
    return failure(providerUnavailable())
  }
}

const isValidText = (raw: string | undefined): boolean =>
  matchMaybe<string, boolean>({
    none: () => false,
    some: (value) => value.length > 0,
  })(fromNullable(raw))

const nonEmptyText = (raw: string | undefined): string | undefined =>
  matchBoolean<string | undefined>({
    false: () => undefined,
    true: () => raw,
  })(isValidText(raw))

const requireText = (raw: string | undefined): string =>
  matchMaybe<string, string>({
    none: () => {
      throw new Error('Google AI returned an empty response.')
    },
    some: (value) => value,
  })(fromNullable(nonEmptyText(raw)))

const createClient = (apiKey: string): GoogleGenAI =>
  new GoogleGenAI({ apiKey })

export const createGoogleAIBogartProvider = (
  config: GoogleAIBogartConfig,
): AIExplanationProvider => {
  const ai = createClient(config.apiKey)

  return {
    explain: (input: AIExplanationInput): AsyncResult<AIExplanationProviderError, string> =>
      tryCatch(async () => {
        const prompt = buildPrompt(input)

        const response = await ai.models.generateContent({
          model: config.model,
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
            temperature: config.temperature,
            maxOutputTokens: config.maxOutputTokens,
          },
        })

        return requireText(response.text)
      }),
  }
}
