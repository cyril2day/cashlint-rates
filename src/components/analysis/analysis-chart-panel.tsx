'use client'

import type { ReactNode } from 'react'
import type { PairChartViewModelDto } from '@/shared/dto/analysis'
import { matchBoolean } from '@/shared/fp'

function AnalysisObservationTable({
  chart,
}: {
  readonly chart: PairChartViewModelDto
}) {
  return (
    <table className="data-table">
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

const chartContent = (chart: PairChartViewModelDto): ReactNode =>
  matchBoolean<ReactNode>({
    false: () => <p className="analysis-result__empty">No cleaned observations to chart.</p>,
    true: () => <AnalysisObservationTable chart={chart} />,
  })(chart.points.length > 0)

export function AnalysisChartPanel({
  chart,
}: {
  readonly chart: PairChartViewModelDto
}) {
  return (
    <div className="chart-panel">
      <h3>{chart.title}</h3>
      <p>{chart.summary}</p>
      {chartContent(chart)}
    </div>
  )
}
