'use client'

import type { PairAnalysisViewModelDto } from '@/shared/dto/analysis'
import { AnalysisChartPanel } from './analysis-chart-panel'
import { AnalysisDataQualityPanel } from './analysis-data-quality-panel'
import { AnalysisFormulaDisclosures } from './analysis-formula-disclosures'
import { AnalysisObservationChart } from './analysis-observation-chart'
import { AnalysisSummaryTable } from './analysis-summary-table'
import { useBogartResultAvailability } from '@/components/bogart'

export function AnalysisResult({ result }: { readonly result: PairAnalysisViewModelDto }) {
  useBogartResultAvailability(result.aiContextSeed)

  return (
    <>
      <section className="analyse-layout__chart" aria-live="polite">
        <AnalysisChartPanel chart={result.chart} />
      </section>
      <section className="analyse-layout__observations analysis-result__observations" aria-label="Cleaned observations">
        <AnalysisObservationChart chart={result.chart} />
      </section>
      <section className="analyse-layout__summary" aria-label="Analysis summary">
        <AnalysisSummaryTable metrics={result.metrics} />
      </section>
      <section className="analyse-layout__quality" aria-label="Data quality">
        <AnalysisDataQualityPanel dataQuality={result.dataQuality} />
      </section>
      <section className="analyse-layout__formulas" aria-label="Formula details">
        <AnalysisFormulaDisclosures explanations={result.calculationExplanations} />
      </section>
    </>
  )
}
