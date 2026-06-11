'use client'

import type {
  AnalysisMetricAvailabilityDto,
  AnalysisMetricValueDto,
  PairAnalysisViewModelDto,
} from '@/shared/dto/analysis'
import type { MaybeDto } from '@/shared/dto/api'
import { matchDtoTag } from '@/shared/fp'

type SummaryRow = {
  readonly key: keyof PairAnalysisViewModelDto['metrics']
  readonly label: string
  readonly metric: AnalysisMetricValueDto
}

const maybeText = (value: MaybeDto<string>, fallback: string): string =>
  matchDtoTag<MaybeDto<string>, string>({
    Just: (just) => just.value,
    Nothing: () => fallback,
  })(value)

const availabilityText = (availability: AnalysisMetricAvailabilityDto): string =>
  matchDtoTag<AnalysisMetricAvailabilityDto, string>({
    Available: () => 'Available',
    Limited: (limited) => limited.reason,
    NotApplicable: (notApplicable) => notApplicable.reason,
    Unavailable: (unavailable) => unavailable.reason,
  })(availability)

const metricValue = (metric: AnalysisMetricValueDto): string =>
  maybeText(metric.displayValue, availabilityText(metric.availability))

const summaryRows = (metrics: PairAnalysisViewModelDto['metrics']): ReadonlyArray<SummaryRow> => [
  {
    key: 'latestReferenceRate',
    label: 'Latest rate',
    metric: metrics.latestReferenceRate,
  },
  {
    key: 'periodMovement',
    label: 'Period movement',
    metric: metrics.periodMovement,
  },
  {
    key: 'observedRange',
    label: 'Observed range',
    metric: metrics.observedRange,
  },
  {
    key: 'typicalMovement',
    label: 'Variability',
    metric: metrics.typicalMovement,
  },
]

const summaryTableRow = (row: SummaryRow) => (
  <tr key={row.key}>
    <th scope="row">{row.label}</th>
    <td>{metricValue(row.metric)}</td>
  </tr>
)

export function AnalysisSummaryTable({
  metrics,
}: {
  readonly metrics: PairAnalysisViewModelDto['metrics']
}) {
  return (
    <div className="analysis-summary">
      <table className="data-table cr-data-table analysis-summary__table">
        <caption>Analysis summary</caption>
        <tbody>{summaryRows(metrics).map(summaryTableRow)}</tbody>
      </table>
    </div>
  )
}
