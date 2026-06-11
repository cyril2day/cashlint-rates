'use client'

import type { ReactNode } from 'react'
import type { PairChartViewModelDto } from '@/shared/dto/analysis'
import { matchBoolean } from '@/shared/fp'

const observationRows = (chart: PairChartViewModelDto) =>
  chart.points.map((point) => (
    <tr key={point.date}>
      <td>{point.date}</td>
      <td>{point.displayRate}</td>
    </tr>
  ))

const populatedTable = (chart: PairChartViewModelDto): ReactNode => (
  <table className="data-table cr-data-table">
    <caption>{chart.tableCaption}</caption>
    <thead>
      <tr>
        <th scope="col">Date</th>
        <th scope="col">Rate</th>
      </tr>
    </thead>
    <tbody>{observationRows(chart)}</tbody>
  </table>
)

export function AnalysisObservationTable({
  chart,
}: {
  readonly chart: PairChartViewModelDto
}) {
  return matchBoolean<ReactNode>({
    false: () => <p className="analysis-result__empty">No cleaned observations to table.</p>,
    true: () => populatedTable(chart),
  })(chart.points.length > 0)
}
