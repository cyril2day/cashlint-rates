import { extent, scaleLinear, scalePoint } from 'd3'
import type { DotPlotPoint, ValidatedDotPlot } from './dot-plot.domain'
import { anyTrue, fromNullable, matchBoolean, matchMaybe } from '@/shared/fp'

type ChartExtent = readonly [number, number]

export type DotPlotRenderedPoint = DotPlotPoint & {
  readonly x: number
  readonly y: number
}

export type DotPlotRenderedTick = {
  readonly value: number
  readonly y: number
  readonly label: string
}

export type DotPlotRenderedLabelTick = {
  readonly label: string
  readonly x: number
  readonly shortLabel: string
}

export type DotPlotModel = {
  readonly plotLeft: number
  readonly plotRight: number
  readonly plotTop: number
  readonly plotBottom: number
  readonly yLabelX: number
  readonly xTicks: ReadonlyArray<DotPlotRenderedLabelTick>
  readonly yTicks: ReadonlyArray<DotPlotRenderedTick>
  readonly points: ReadonlyArray<DotPlotRenderedPoint>
}

const margin = {
  bottom: 24,
  left: 24,
  right: 24,
  top: 28,
}

const yLabelGap = 8
const yLabelCharacterWidth = 7
const maximumPlotLeftShare = 0.34

const allLabels = (plot: ValidatedDotPlot): ReadonlyArray<string> =>
  Array.from(new Set(plot.points.map((point) => point.xLabel)))

const allYValues = (plot: ValidatedDotPlot): ReadonlyArray<number> =>
  plot.points.map((point) => point.yValue)

const numberOrDefault =
  (fallback: number) =>
  (value: number | undefined): number =>
    matchMaybe<number, number>({
      none: () => fallback,
      some: (numberValue) => numberValue,
    })(fromNullable(value))

const extentOrDefault = (values: ReadonlyArray<number>): ChartExtent => {
  const valueExtent = extent(values)

  return [
    numberOrDefault(0)(valueExtent[0]),
    numberOrDefault(1)(valueExtent[1]),
  ]
}

const expandFlatExtent = ([minimum, maximum]: ChartExtent): ChartExtent =>
  matchBoolean<ChartExtent>({
    false: () => [minimum, maximum],
    true: () => [minimum - 1, maximum + 1],
  })(minimum === maximum)

const tickLabel = (value: number): string =>
  matchBoolean<string>({
    false: () => value.toPrecision(4),
    true: () => String(value),
  })(Number.isInteger(value))

const estimatedLabelWidth = (label: string): number =>
  label.length * yLabelCharacterWidth

const requiredPlotLeft = (tickValues: ReadonlyArray<number>): number =>
  Math.max(...tickValues.map((value) => estimatedLabelWidth(tickLabel(value)))) + yLabelGap

const plotLeftForTicks = (tickValues: ReadonlyArray<number>, width: number): number =>
  Math.min(
    Math.max(margin.left, requiredPlotLeft(tickValues)),
    Math.max(margin.left, width * maximumPlotLeftShare),
  )

const labelTickStep = (labels: ReadonlyArray<string>): number =>
  Math.max(1, Math.ceil(labels.length / 6))

const isLabelTick =
  (labels: ReadonlyArray<string>, step: number) =>
  (_label: string, index: number): boolean =>
    anyTrue([
      index === 0,
      index === labels.length - 1,
      index % step === 0,
    ])

const shortLabel = (label: string): string =>
  matchBoolean<string>({
    false: () => label,
    true: () => label.slice(5),
  })(label.length === 10)

const renderLabelTick =
  (plotLeft: number, xScale: (label: string) => number | undefined) =>
  (label: string): DotPlotRenderedLabelTick => ({
    label,
    x: numberOrDefault(plotLeft)(xScale(label)),
    shortLabel: shortLabel(label),
  })

const renderLabelTicks = (
  labels: ReadonlyArray<string>,
  plotLeft: number,
  xScale: (label: string) => number | undefined,
): ReadonlyArray<DotPlotRenderedLabelTick> => {
  const step = labelTickStep(labels)

  return labels
    .filter(isLabelTick(labels, step))
    .map(renderLabelTick(plotLeft, xScale))
}

const renderPoint =
  (
    plotLeft: number,
    xScale: (label: string) => number | undefined,
    yScale: (value: number) => number,
  ) =>
  (point: DotPlotPoint): DotPlotRenderedPoint => ({
    ...point,
    x: numberOrDefault(plotLeft)(xScale(point.xLabel)),
    y: yScale(point.yValue),
  })

const renderTick =
  (yScale: (value: number) => number) =>
  (value: number): DotPlotRenderedTick => ({
    value,
    y: yScale(value),
    label: tickLabel(value),
  })

export const buildDotPlotModel = (
  plot: ValidatedDotPlot,
  width: number,
  height: number,
): DotPlotModel => {
  const labels = allLabels(plot)
  const [minimum, maximum] = expandFlatExtent(extentOrDefault(allYValues(plot)))
  const plotBottom = height - margin.bottom
  const plotRight = width - margin.right
  const yTickValues = scaleLinear()
    .domain([minimum, maximum])
    .nice()
    .range([plotBottom, margin.top])
    .ticks(4)
  const plotLeft = plotLeftForTicks(yTickValues, width)
  const xScale = scalePoint()
    .domain([...labels])
    .range([plotLeft, plotRight])
  const yScale = scaleLinear()
    .domain([minimum, maximum])
    .nice()
    .range([plotBottom, margin.top])

  return {
    plotLeft,
    plotRight,
    plotTop: margin.top,
    plotBottom,
    yLabelX: plotLeft - yLabelGap,
    xTicks: renderLabelTicks(labels, plotLeft, xScale),
    yTicks: yTickValues.map(renderTick(yScale)),
    points: plot.points.map(renderPoint(plotLeft, xScale, yScale)),
  }
}
