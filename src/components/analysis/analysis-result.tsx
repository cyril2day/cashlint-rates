'use client'

import type { PairAnalysisViewModelDto } from '@/shared/dto/analysis'
import { AnalysisChartPanel } from './analysis-chart-panel'
import { AnalysisDataQualityPanel } from './analysis-data-quality-panel'
import { AnalysisFormulaDisclosures } from './analysis-formula-disclosures'
import { AnalysisMetricGrid } from './analysis-metric-grid'
import { useBogartResultAvailability } from '@/components/bogart'

export function AnalysisResult({ result }: { readonly result: PairAnalysisViewModelDto }) {
  useBogartResultAvailability(result.aiContextSeed)

  return (
    <>
      <section className="analyse-layout__chart" aria-live="polite">
        <AnalysisChartPanel chart={result.chart} />
      </section>
      <section className="analyse-layout__full" aria-label="Analysis metrics">
        <AnalysisMetricGrid metrics={result.metrics} />
      </section>
      <section className="analyse-layout__full" aria-label="Data quality">
        <AnalysisDataQualityPanel dataQuality={result.dataQuality} />
      </section>
      <section className="analyse-layout__full" aria-label="Formula details">
        <AnalysisFormulaDisclosures explanations={result.calculationExplanations} />
      </section>
    </>
  )
}
