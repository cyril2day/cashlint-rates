'use client'

import type { ReactNode } from 'react'
import { useId } from 'react'
import { none } from 'pristine-charts'
import { LineChart, formatLineChartNumber } from 'pristine-charts/line-chart'
import type { PairChartPointDto, PairChartViewModelDto } from '@/shared/dto/analysis'
import { chainMaybe, fromNullable, matchBoolean, matchMaybe } from '@/shared/fp'

function AnalysisObservationTable({
  chart,
}: {
  readonly chart: PairChartViewModelDto
}) {
  return (
    <table className="data-table cr-data-table">
      <caption>{chart.tableCaption}</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Rate</th>
        </tr>
      </thead>
      <tbody>
        {chart.points.map((point) => (
          <tr key={point.date}>
            <td>{point.date}</td>
            <td>{point.displayRate}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const lineChartPoint = (point: PairChartViewModelDto['points'][number], index: number) => ({
  x: index,
  y: point.rate,
})

const formatChartDate =
  (chart: PairChartViewModelDto) =>
  (value: number): string =>
    matchMaybe<string, string>({
      none: () => String(value),
      some: (date) => date,
    })(
      chainMaybe((p: PairChartPointDto) => fromNullable(p.date))(
        fromNullable(chart.points[Math.round(value)]),
      ),
    )

function AnalysisLineChart({
  chart,
}: {
  readonly chart: PairChartViewModelDto
}) {
  return (
    <div className="chart-panel__visual cr-chart-panel__visual">
      <LineChart
        ariaLabel={chart.summary}
        caption={none}
        className="chart-panel__line-chart"
        data={chart.points.map(lineChartPoint)}
        formatXValue={formatChartDate(chart)}
        formatYValue={formatLineChartNumber}
        height={240}
        showPoints
        width={720}
      />
    </div>
  )
}

const chartContent = (chart: PairChartViewModelDto): ReactNode =>
  matchBoolean<ReactNode>({
    false: () => <p className="analysis-result__empty">No cleaned observations to chart.</p>,
    true: () => (
      <>
        <AnalysisLineChart chart={chart} />
        <AnalysisObservationTable chart={chart} />
      </>
    ),
  })(chart.points.length > 0)

export function AnalysisChartPanel({
  chart,
}: {
  readonly chart: PairChartViewModelDto
}) {
  const summaryId = useId()
  const titleId = useId()
  const statusText = matchBoolean<string>({
    false: () => 'Chart unavailable',
    true: () => 'Chart ready',
  })(chart.points.length > 0)

  return (
    <div className="chart-panel cr-chart-panel" aria-describedby={summaryId} aria-labelledby={titleId} role="region">
      <h3 id={titleId}>{chart.title}</h3>
      <span className="chart-panel__status cr-chart-panel__status">{statusText}</span>
      <p className="chart-panel__summary cr-chart-panel__summary" id={summaryId}>{chart.summary}</p>
      {chartContent(chart)}
    </div>
  )
}
