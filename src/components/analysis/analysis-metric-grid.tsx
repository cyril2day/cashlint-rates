'use client'

import type { AnalysisMetricValueDto, PairAnalysisViewModelDto } from '@/shared/dto/analysis'
import type { MaybeDto } from '@/shared/dto/api'
import { matchDtoTag } from '@/shared/fp'

type MetricItem = {
  readonly key: keyof PairAnalysisViewModelDto['metrics']
  readonly metric: AnalysisMetricValueDto
}

const metricLabel: Readonly<Record<keyof PairAnalysisViewModelDto['metrics'], string>> = {
  averageRate: 'Average rate',
  awayFromTypical: 'Away from typical',
  latestPosition: 'Latest position',
  latestReferenceRate: 'Latest reference rate',
  observedRange: 'Observed range',
  periodMovement: 'Period movement',
  typicalMovement: 'Typical movement',
}

const maybeText = (value: MaybeDto<string>, fallback: string): string =>
  matchDtoTag<MaybeDto<string>, string>({
    Just: (just) => just.value,
    Nothing: () => fallback,
  })(value)

const metricValue = (metric: AnalysisMetricValueDto): string =>
  maybeText(metric.displayValue, metric.availability._tag)

const metricItems = (metrics: PairAnalysisViewModelDto['metrics']): ReadonlyArray<MetricItem> => [
  { key: 'latestReferenceRate', metric: metrics.latestReferenceRate },
  { key: 'periodMovement', metric: metrics.periodMovement },
  { key: 'averageRate', metric: metrics.averageRate },
  { key: 'observedRange', metric: metrics.observedRange },
  { key: 'latestPosition', metric: metrics.latestPosition },
  { key: 'awayFromTypical', metric: metrics.awayFromTypical },
  { key: 'typicalMovement', metric: metrics.typicalMovement },
]

function AnalysisMetricCard({ item }: { readonly item: MetricItem }) {
  return (
    <article className="metric-card">
      <span className="metric-card__label">{metricLabel[item.key]}</span>
      <strong>{metricValue(item.metric)}</strong>
    </article>
  )
}

export function AnalysisMetricGrid({
  metrics,
}: {
  readonly metrics: PairAnalysisViewModelDto['metrics']
}) {
  return (
    <div className="metric-grid">
      {metricItems(metrics).map((item) => (
        <AnalysisMetricCard item={item} key={item.key} />
      ))}
    </div>
  )
}
