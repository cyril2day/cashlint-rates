import { fromNullable, matchMaybe, type Maybe } from '@/shared/fp'

export type AnalysisMetricKey =
  | 'latest-reference-rate'
  | 'period-movement'
  | 'average-rate'
  | 'observed-range'
  | 'latest-position'
  | 'away-from-typical'
  | 'typical-movement'

export type FormulaKey = AnalysisMetricKey

export type FormulaInputDefinition = {
  readonly key: string
  readonly label: string
  readonly description: string
}

export type FormulaRegistryEntry = {
  readonly formulaKey: FormulaKey
  readonly metricKey: AnalysisMetricKey
  readonly title: string
  readonly plainMeaning: string
  readonly latex: string
  readonly accessibleFormulaText: string
  readonly inputs: ReadonlyArray<FormulaInputDefinition>
  readonly steps: ReadonlyArray<string>
  readonly interpretation: string
  readonly caveat: string
  readonly bogartSummary: string
}

export type FormulaSummary = {
  readonly formulaKey: FormulaKey
  readonly metricKey: AnalysisMetricKey
  readonly title: string
  readonly summary: string
  readonly accessibleFormulaText: string
}

const sourceRateInput: FormulaInputDefinition = {
  key: 'rate',
  label: 'Rate',
  description: 'A cleaned historical reference-rate observation for the selected pair.',
}

export const analysisFormulaRegistry: Readonly<Record<FormulaKey, FormulaRegistryEntry>> = {
  'latest-reference-rate': {
    formulaKey: 'latest-reference-rate',
    metricKey: 'latest-reference-rate',
    title: 'Latest reference rate',
    plainMeaning: 'The most recent valid reference-rate observation in the selected period.',
    latex: String.raw`r_{\mathrm{latest}} = r_n`,
    accessibleFormulaText: 'Latest reference rate equals the final cleaned rate observation.',
    inputs: [
      {
        key: 'r_n',
        label: 'Latest rate',
        description: 'The last cleaned rate observation by effective date.',
      },
    ],
    steps: [
      'Clean invalid provider observations.',
      'Order the remaining observations by effective date.',
      'Use the final observed rate as the latest reference rate.',
    ],
    interpretation: 'This is a historical/reference-rate observation, not a live market quote.',
    caveat: 'Provider dates are not forward-filled, so the latest effective date may be before the requested end date.',
    bogartSummary: 'Latest reference rate uses the final cleaned observation in the selected period.',
  },
  'period-movement': {
    formulaKey: 'period-movement',
    metricKey: 'period-movement',
    title: 'Period movement',
    plainMeaning: 'How far the latest valid rate moved from the first valid rate in the selected period.',
    latex: String.raw`\frac{r_n - r_1}{r_1} \times 100`,
    accessibleFormulaText: 'Period movement equals latest rate minus first rate, divided by first rate, multiplied by one hundred.',
    inputs: [
      {
        key: 'r_1',
        label: 'First rate',
        description: 'The first cleaned rate observation by effective date.',
      },
      {
        key: 'r_n',
        label: 'Latest rate',
        description: 'The last cleaned rate observation by effective date.',
      },
    ],
    steps: [
      'Take the first and latest cleaned observations.',
      'Subtract the first rate from the latest rate.',
      'Divide by the first rate and multiply by 100.',
    ],
    interpretation: 'Positive values mean the displayed rate increased over the observed period; negative values mean it decreased.',
    caveat: 'This describes past observed movement only and does not predict future exchange rates.',
    bogartSummary: 'Period movement is the percent change from the first cleaned rate to the latest cleaned rate.',
  },
  'average-rate': {
    formulaKey: 'average-rate',
    metricKey: 'average-rate',
    title: 'Average rate',
    plainMeaning: 'The arithmetic mean of valid observed reference rates in the selected period.',
    latex: String.raw`\bar{r} = \frac{1}{n}\sum_{i=1}^{n} r_i`,
    accessibleFormulaText: 'Average rate equals the sum of cleaned rates divided by the number of cleaned observations.',
    inputs: [
      sourceRateInput,
      {
        key: 'n',
        label: 'Observation count',
        description: 'The number of cleaned observations in the selected period.',
      },
    ],
    steps: [
      'Add all cleaned observed rates.',
      'Divide the total by the cleaned observation count.',
    ],
    interpretation: 'The average gives a central level for the selected period.',
    caveat: 'The average can hide short spikes, gaps, and clustered observations.',
    bogartSummary: 'Average rate is the arithmetic mean of the cleaned observations.',
  },
  'observed-range': {
    formulaKey: 'observed-range',
    metricKey: 'observed-range',
    title: 'Observed range',
    plainMeaning: 'The distance between the highest and lowest valid observed rates.',
    latex: String.raw`\max(r) - \min(r)`,
    accessibleFormulaText: 'Observed range equals maximum cleaned rate minus minimum cleaned rate.',
    inputs: [sourceRateInput],
    steps: [
      'Find the minimum cleaned observed rate.',
      'Find the maximum cleaned observed rate.',
      'Subtract the minimum from the maximum.',
    ],
    interpretation: 'A wider range means the observed reference-rate levels were more spread out.',
    caveat: 'Range is sensitive to single extreme observations.',
    bogartSummary: 'Observed range is the maximum cleaned rate minus the minimum cleaned rate.',
  },
  'latest-position': {
    formulaKey: 'latest-position',
    metricKey: 'latest-position',
    title: 'Latest position',
    plainMeaning: 'Where the latest rate sits within the selected period as a percentile position.',
    latex: String.raw`\frac{\#\{r_i \le r_n\}}{n} \times 100`,
    accessibleFormulaText: 'Latest position equals the count of cleaned rates less than or equal to the latest rate, divided by the observation count, multiplied by one hundred.',
    inputs: [
      sourceRateInput,
      {
        key: 'r_n',
        label: 'Latest rate',
        description: 'The final cleaned rate observation by effective date.',
      },
    ],
    steps: [
      'Count cleaned rates less than or equal to the latest rate.',
      'Divide by the cleaned observation count.',
      'Multiply by 100 to express the result as a percentile position.',
    ],
    interpretation: 'Higher values mean the latest rate is near the upper end of the observed period.',
    caveat: 'Percentile position depends only on the selected period and is not a universal ranking.',
    bogartSummary: 'Latest position is the percentile position of the latest rate within the cleaned observations.',
  },
  'away-from-typical': {
    formulaKey: 'away-from-typical',
    metricKey: 'away-from-typical',
    title: 'Away from typical',
    plainMeaning: 'How many level standard deviations the latest rate is away from the period average.',
    latex: String.raw`z = \frac{r_n - \bar{r}}{\sigma}`,
    accessibleFormulaText: 'Away from typical equals latest rate minus average rate, divided by population standard deviation of observed rate levels.',
    inputs: [
      {
        key: 'r_n',
        label: 'Latest rate',
        description: 'The final cleaned rate observation by effective date.',
      },
      {
        key: 'mean',
        label: 'Average rate',
        description: 'The arithmetic mean of cleaned observed rates.',
      },
      {
        key: 'sigma',
        label: 'Population standard deviation',
        description: 'The population standard deviation of cleaned observed rate levels.',
      },
    ],
    steps: [
      'Subtract the average rate from the latest rate.',
      'Divide by the population standard deviation of rate levels.',
      'Suppress the metric when the standard deviation is zero.',
    ],
    interpretation: 'Larger absolute values mean the latest rate is farther from the selected period average.',
    caveat: 'This is unavailable for a constant series and should not be treated as a probability forecast.',
    bogartSummary: 'Away from typical is a z-score for the latest rate against the selected period level distribution.',
  },
  'typical-movement': {
    formulaKey: 'typical-movement',
    metricKey: 'typical-movement',
    title: 'Typical movement',
    plainMeaning: 'The sample standard deviation of successive log returns, expressed as a percentage.',
    latex: String.raw`s_{\ell} = \sqrt{\frac{\sum_{i=2}^{n}(\ell_i - \bar{\ell})^2}{m - 1}} \times 100`,
    accessibleFormulaText: 'Typical movement equals the sample standard deviation of log returns, multiplied by one hundred.',
    inputs: [
      {
        key: 'ell_i',
        label: 'Log return',
        description: 'The natural logarithm of each rate divided by the previous rate.',
      },
      {
        key: 'm',
        label: 'Return count',
        description: 'The number of available successive log-return observations.',
      },
    ],
    steps: [
      'Convert successive cleaned rates into log returns.',
      'Calculate the sample standard deviation of those log returns.',
      'Multiply by 100 to express typical movement as a percentage.',
    ],
    interpretation: 'Lower values mean steadier observed movement during the selected period.',
    caveat: 'At least two log returns are needed before this movement variability metric is shown.',
    bogartSummary: 'Typical movement is the sample standard deviation of successive log returns, shown as a percentage.',
  },
}

export const analysisMetricKeys: ReadonlyArray<AnalysisMetricKey> = [
  'latest-reference-rate',
  'period-movement',
  'average-rate',
  'observed-range',
  'latest-position',
  'away-from-typical',
  'typical-movement',
]

export const analysisFormulaEntries: ReadonlyArray<FormulaRegistryEntry> =
  analysisMetricKeys.map((metricKey) => analysisFormulaRegistry[metricKey])

export const lookupAnalysisFormula = (
  metricKey: AnalysisMetricKey,
): Maybe<FormulaRegistryEntry> =>
  fromNullable(analysisFormulaRegistry[metricKey])

const toFormulaSummary = (entry: FormulaRegistryEntry): FormulaSummary => ({
  formulaKey: entry.formulaKey,
  metricKey: entry.metricKey,
  title: entry.title,
  summary: entry.bogartSummary,
  accessibleFormulaText: entry.accessibleFormulaText,
})

const formulaSummaryForMetric = (metricKey: AnalysisMetricKey): ReadonlyArray<FormulaSummary> =>
  matchMaybe<FormulaRegistryEntry, ReadonlyArray<FormulaSummary>>({
    none: () => [],
    some: (entry) => [toFormulaSummary(entry)],
  })(lookupAnalysisFormula(metricKey))

export const formulaSummariesForMetrics = (
  metricKeys: ReadonlyArray<AnalysisMetricKey>,
): ReadonlyArray<FormulaSummary> =>
  metricKeys.flatMap(formulaSummaryForMetric)
