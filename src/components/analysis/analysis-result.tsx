'use client'

import type { PairAnalysisViewModelDto } from '@/shared/dto/analysis'
import { AnalysisChartPanel } from './analysis-chart-panel'
import { AnalysisDataQualityPanel } from './analysis-data-quality-panel'
import { AnalysisFormulaDisclosures } from './analysis-formula-disclosures'
import { AnalysisMetricGrid } from './analysis-metric-grid'
import { AnalysisResultHeader } from './analysis-result-header'

export function AnalysisResult({ result }: { readonly result: PairAnalysisViewModelDto }) {
  return (
    <section className="analysis-result" aria-live="polite">
      <AnalysisResultHeader result={result} />
      <AnalysisMetricGrid metrics={result.metrics} />
      <AnalysisChartPanel chart={result.chart} />
      <AnalysisDataQualityPanel dataQuality={result.dataQuality} />
      <AnalysisFormulaDisclosures explanations={result.calculationExplanations} />
    </section>
  )
}
