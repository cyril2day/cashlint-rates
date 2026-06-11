'use client'

import type { ReactNode } from 'react'
import type { PairChartPointDto, PairChartViewModelDto } from '@/shared/dto/analysis'
import { DotPlot } from '@/components/charts'
import { matchBoolean } from '@/shared/fp'

const observationPoint = (point: PairChartPointDto) => ({
  id: point.date,
  xLabel: point.date,
  yValue: point.rate,
  displayYValue: point.displayRate,
  ariaLabel: `${point.date}: rate ${point.displayRate}`,
})

const plottableObservationCount = (chart: PairChartViewModelDto) => chart.points.length >= 2

const chartHeight = (chart: PairChartViewModelDto): number =>
  Math.min(260, Math.max(150, (chart.points.length * 4) + 96))

const populatedChart = (chart: PairChartViewModelDto): ReactNode => (
  <DotPlot
    ariaLabel={`${chart.tableCaption} dot plot`}
    className="analysis-observation-chart cr-analysis-observation-chart"
    height={chartHeight(chart)}
    plot={{ points: chart.points.map(observationPoint) }}
    width={640}
  />
)

type AnalysisObservationChartProps = {
  readonly chart: PairChartViewModelDto
}

export function AnalysisObservationChart({ chart }: AnalysisObservationChartProps) {
  return matchBoolean<ReactNode>({
    false: () => <p className="analysis-result__empty">Need at least two cleaned observations to plot.</p>,
    true: () => populatedChart(chart),
  })(plottableObservationCount(chart))
}
