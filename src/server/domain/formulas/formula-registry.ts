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
    plainMeaning: 'Latest available reference rate in the selected period.',
    latex: String.raw`r_{\mathrm{latest}} = r_n`,
    accessibleFormulaText: 'Latest reference rate equals the last cleaned rate observation.',
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
    caveat: 'Missing provider dates are not filled in, so the latest available date can be earlier than the requested end date.',
    bogartSummary: 'Latest reference rate uses the last cleaned observation in the selected period.',
  },
  'period-movement': {
    formulaKey: 'period-movement',
    metricKey: 'period-movement',
    title: 'Period movement',
    plainMeaning: 'Change from the first effective observation to the latest available observation.',
    latex: String.raw`\frac{r_n - r_1}{r_1} \times 100`,
    accessibleFormulaText: 'Period movement equals latest rate minus first rate, divided by first rate, times 100.',
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
    interpretation: 'Positive values mean the displayed reference rate increased over the selected period; negative values mean it decreased.',
    caveat: 'This describes past observed movement only and does not predict future exchange rates.',
    bogartSummary: 'Period movement compares the first effective observation with the latest available observation.',
  },
  'average-rate': {
    formulaKey: 'average-rate',
    metricKey: 'average-rate',
    title: 'Average rate',
    plainMeaning: 'Mean reference rate across available observations.',
    latex: String.raw`\bar{r} = \frac{1}{n}\sum_{i=1}^{n} r_i`,
    accessibleFormulaText: 'Average rate equals the sum of available rates divided by the number of observations.',
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
    interpretation: 'The average gives a central reference level for the selected period.',
    caveat: 'Averages can hide short spikes, missing dates, and clustered observations.',
    bogartSummary: 'Average rate is the mean of available observations in the selected period.',
  },
  'observed-range': {
    formulaKey: 'observed-range',
    metricKey: 'observed-range',
    title: 'Observed range',
    plainMeaning: 'The gap between the lowest and highest available reference rates.',
    latex: String.raw`\max(r) - \min(r)`,
    accessibleFormulaText: 'Observed range equals highest available rate minus lowest available rate.',
    inputs: [sourceRateInput],
    steps: [
      'Find the minimum cleaned observed rate.',
      'Find the maximum cleaned observed rate.',
      'Subtract the minimum from the maximum.',
    ],
    interpretation: 'A wider range means the observed reference rates were more spread out.',
    caveat: 'Range is sensitive to single extreme observations.',
    bogartSummary: 'Observed range shows the distance between the lowest and highest available rates.',
  },
  'latest-position': {
    formulaKey: 'latest-position',
    metricKey: 'latest-position',
    title: 'Latest position',
    plainMeaning: 'Where the latest rate sits compared with the selected observations.',
    latex: String.raw`\frac{\#\{r_i \le r_n\}}{n} \times 100`,
    accessibleFormulaText: 'Latest position equals the share of observations at or below the latest rate, times 100.',
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
    interpretation: 'Higher values mean the latest rate sits nearer the upper end of the selected observations.',
    caveat: 'Latest position depends only on the selected period and is not a universal ranking.',
    bogartSummary: 'Latest position shows where the latest rate sits among the selected observations.',
  },
  'away-from-typical': {
    formulaKey: 'away-from-typical',
    metricKey: 'away-from-typical',
    title: 'Away from typical',
    plainMeaning: 'How far the latest rate sits from the period average.',
    latex: String.raw`z = \frac{r_n - \bar{r}}{\sigma}`,
    accessibleFormulaText: 'Away from typical equals latest rate minus average rate, divided by the standard deviation of observed rates.',
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
    interpretation: 'Larger absolute values mean the latest rate sits farther from the selected period average.',
    caveat: 'This is unavailable when the observed rate does not vary in the selected period.',
    bogartSummary: 'Away from typical shows how far the latest rate sits from the selected period average.',
  },
  'typical-movement': {
    formulaKey: 'typical-movement',
    metricKey: 'typical-movement',
    title: 'Typical movement',
    plainMeaning: 'Typical observed movement between provider observations.',
    latex: String.raw`s_{\ell} = \sqrt{\frac{\sum_{i=2}^{n}(\ell_i - \bar{\ell})^2}{m - 1}} \times 100`,
    accessibleFormulaText: 'Typical movement equals the sample standard deviation of log returns, times 100.',
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
    interpretation: 'Lower values mean steadier observed movement between provider observations in the selected period.',
    caveat: 'At least two log returns are needed before this movement variability metric is shown.',
    bogartSummary: 'Typical movement shows the usual proportional movement between provider observations.',
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
