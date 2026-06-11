'use client'

import type { ReactNode } from 'react'
import { useId } from 'react'
import type {
  ComparisonMetricValueDto,
  ComparisonViewModelDto,
  IndexedComparisonChartViewModelDto,
} from '@/shared/dto/comparison'
import { IndexedComparisonChart } from '@/components/charts'
import { useBogartResultAvailability } from '@/components/bogart'
import { matchBoolean, matchDtoTag } from '@/shared/fp'

const maybeMetricText = (metric: ComparisonMetricValueDto): string =>
  matchDtoTag<ComparisonMetricValueDto['displayValue'], string>({
    Just: (value) => value.value,
    Nothing: () =>
      matchDtoTag<ComparisonMetricValueDto['availability'], string>({
        Available: () => 'Available',
        NotApplicable: (availability) => availability.reason,
        Unavailable: (availability) => availability.reason,
      })(metric.availability),
  })(metric.displayValue)

function ComparisonChartPanel({ chart }: { readonly chart: IndexedComparisonChartViewModelDto }) {
  const summaryId = useId()
  const titleId = useId()

  return (
    <div className="chart-panel cr-chart-panel" aria-describedby={summaryId} aria-labelledby={titleId} role="region">
      <h3 id={titleId}>{chart.title}</h3>
      <p className="chart-panel__summary cr-chart-panel__summary" id={summaryId}>{chart.summary}</p>
      {matchBoolean<ReactNode>({
        false: () => <p className="analysis-result__empty">No indexed observations to chart.</p>,
        true: () => <IndexedComparisonChart ariaDescribedBy={summaryId} ariaLabel={chart.summary} chart={chart} height={240} width={720} />,
      })(chart.points.length > 0)}
    </div>
  )
}

function ComparisonRowsTable({ result }: { readonly result: ComparisonViewModelDto }) {
  return (
    <table className="data-table cr-data-table">
      <caption>{result.chart.tableCaption}</caption>
      <thead>
        <tr>
          <th scope="col">Quote</th>
          <th scope="col">Latest rate</th>
          <th scope="col">Period movement</th>
          <th scope="col">Relative variability</th>
        </tr>
      </thead>
      <tbody>
        {result.rows.map((row) => (
          <tr key={row.quote.code}>
            <td>{row.quote.code}</td>
            <td>{maybeMetricText(row.latestReferenceRate)}</td>
            <td>{maybeMetricText(row.periodMovement)}</td>
            <td>{maybeMetricText(row.relativeVariability)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ComparisonResult({ result }: { readonly result: ComparisonViewModelDto }) {
  useBogartResultAvailability(result.aiContextSeed)

  return (
    <>
      <section className="compare-layout__chart" aria-live="polite">
        <ComparisonChartPanel chart={result.chart} />
      </section>
      <section className="compare-layout__full" aria-label="Comparison details">
        <ComparisonRowsTable result={result} />
      </section>
    </>
  )
}
