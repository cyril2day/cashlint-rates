import { describe, expect, it } from 'vitest'
import {
  analysisFormulaEntries,
  analysisMetricKeys,
  formulaSummariesForMetrics,
  lookupAnalysisFormula,
  type FormulaRegistryEntry,
} from '@/server/domain/formulas/formula-registry'
import type { Maybe } from '@/shared/fp'

const expectSome = <A>(maybe: Maybe<A>): A => {
  if (maybe.tag === 'none') {
    throw new Error('Expected Some, got None')
  }

  return maybe.value
}

const plainLanguageFields = (entry: FormulaRegistryEntry): ReadonlyArray<string> => [
  entry.plainMeaning,
  entry.accessibleFormulaText,
  entry.interpretation,
  entry.caveat,
  entry.bogartSummary,
]

describe('formula registry domain', () => {
  it('keeps displayed analysis metrics and formula metadata on the same keys', () => {
    const formulaKeys = analysisFormulaEntries.map((entry) => entry.formulaKey)
    const metricKeys = analysisFormulaEntries.map((entry) => entry.metricKey)

    expect(formulaKeys).toEqual(analysisMetricKeys)
    expect(metricKeys).toEqual(analysisMetricKeys)
  })

  it('provides KaTeX-compatible formulas with plain-language fallback copy', () => {
    analysisFormulaEntries.forEach((entry) => {
      expect(entry.latex.length).toBeGreaterThan(0)
      expect(entry.title.length).toBeGreaterThan(0)
      expect(entry.inputs.length).toBeGreaterThan(0)
      expect(entry.steps.length).toBeGreaterThan(0)
      plainLanguageFields(entry).forEach((field) => {
        expect(field.length).toBeGreaterThan(0)
      })
    })
  })

  it('looks up the period movement formula used by the statistician QA vector', () => {
    const entry = expectSome(lookupAnalysisFormula('period-movement'))

    expect(entry.latex).toBe(String.raw`\frac{r_n - r_1}{r_1} \times 100`)
    expect(entry.accessibleFormulaText).toBe(
      'Period movement equals latest rate minus first rate, divided by first rate, multiplied by one hundred.',
    )
  })

  it('builds Bogart-safe formula summaries from selected metric keys', () => {
    const summaries = formulaSummariesForMetrics([
      'latest-reference-rate',
      'typical-movement',
    ])

    expect(summaries).toEqual([
      {
        formulaKey: 'latest-reference-rate',
        metricKey: 'latest-reference-rate',
        title: 'Latest reference rate',
        summary: 'Latest reference rate uses the final cleaned observation in the selected period.',
        accessibleFormulaText: 'Latest reference rate equals the final cleaned rate observation.',
      },
      {
        formulaKey: 'typical-movement',
        metricKey: 'typical-movement',
        title: 'Typical movement',
        summary: 'Typical movement is the sample standard deviation of successive log returns, shown as a percentage.',
        accessibleFormulaText: 'Typical movement equals the sample standard deviation of log returns, multiplied by one hundred.',
      },
    ])
  })
})
