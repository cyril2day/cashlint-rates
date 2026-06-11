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

const populatedChart = (chart: PairChartViewModelDto): ReactNode => (
  <DotPlot
    ariaLabel={`${chart.tableCaption} dot plot`}
    className="analysis-observation-chart cr-analysis-observation-chart"
    height={220}
    plot={{ points: chart.points.map(observationPoint) }}
    width={720}
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
