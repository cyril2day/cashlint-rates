import { extent, scaleLinear } from 'd3'
import type { DotPlotPoint, ValidatedDotPlot } from './dot-plot.domain'
import { fromNullable, matchBoolean, matchMaybe } from '@/shared/fp'

type ChartExtent = readonly [number, number]

export type DotPlotRenderedPoint = DotPlotPoint & {
  readonly x: number
  readonly y: number
}

export type DotPlotRenderedTick = {
  readonly value: number
  readonly x: number
  readonly label: string
}

export type DotPlotModel = {
  readonly plotLeft: number
  readonly plotRight: number
  readonly plotTop: number
  readonly plotBottom: number
  readonly baselineY: number
  readonly xTicks: ReadonlyArray<DotPlotRenderedTick>
  readonly points: ReadonlyArray<DotPlotRenderedPoint>
}

const margin = {
  bottom: 34,
  left: 36,
  right: 28,
  top: 34,
}

const dotRadius = 4
const stackGap = 3
const defaultDotStep = (dotRadius * 2) + stackGap

const allValues = (plot: ValidatedDotPlot): ReadonlyArray<number> =>
  plot.points.map((point) => point.yValue)

const maximumStackIndex = (stackIndexes: ReadonlyArray<number>): number =>
  stackIndexes.reduce((maximum, stackIndex) => Math.max(maximum, stackIndex), 0)

const fittedDotStep = (baselineY: number, plotTop: number, maximumStack: number): number =>
  matchBoolean<number>({
    false: () => defaultDotStep,
    true: () => Math.min(defaultDotStep, (baselineY - plotTop) / maximumStack),
  })(maximumStack > 0)

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

const clamp = (minimum: number, maximum: number, value: number): number =>
  Math.min(Math.max(value, minimum), maximum)

const binCount = (pointCount: number): number =>
  clamp(4, 12, Math.ceil(Math.sqrt(pointCount)))

const binWidth = (minimum: number, maximum: number, count: number): number =>
  (maximum - minimum) / count

const rawBinIndex =
  (minimum: number, width: number) =>
  (value: number): number =>
    Math.floor((value - minimum) / width)

const binIndex =
  (minimum: number, maximum: number, count: number) =>
  (value: number): number =>
    clamp(0, count - 1, rawBinIndex(minimum, binWidth(minimum, maximum, count))(value))

const binMidpoint = (minimum: number, width: number, index: number): number =>
  minimum + (width * index) + (width / 2)

const precedingBinMatches =
  (indexForValue: (value: number) => number, point: DotPlotPoint) =>
  (candidate: DotPlotPoint): boolean =>
    indexForValue(candidate.yValue) === indexForValue(point.yValue)

const stackIndex =
  (points: ReadonlyArray<DotPlotPoint>, indexForValue: (value: number) => number) =>
  (point: DotPlotPoint, index: number): number =>
    points
      .slice(0, index)
      .filter(precedingBinMatches(indexForValue, point))
      .length

const renderPoint =
  (
    baselineY: number,
    binCentre: (value: number) => number,
    dotStep: number,
    stackAt: (point: DotPlotPoint, index: number) => number,
    xScale: (value: number) => number,
  ) =>
  (point: DotPlotPoint, index: number): DotPlotRenderedPoint => ({
    ...point,
    x: xScale(binCentre(point.yValue)),
    y: baselineY - (stackAt(point, index) * dotStep),
  })

const renderValueTick =
  (xScale: (value: number) => number) =>
  (value: number): DotPlotRenderedTick => ({
    value,
    x: xScale(value),
    label: tickLabel(value),
  })

export const buildDotPlotModel = (
  plot: ValidatedDotPlot,
  width: number,
  height: number,
): DotPlotModel => {
  const [minimum, maximum] = expandFlatExtent(extentOrDefault(allValues(plot)))
  const plotBottom = height - margin.bottom
  const plotRight = width - margin.right
  const plotLeft = margin.left
  const baselineY = plotBottom - dotRadius
  const xScale = scaleLinear()
    .domain([minimum, maximum])
    .nice()
    .range([plotLeft, plotRight])
  const domain = xScale.domain()
  const domainMinimum = numberOrDefault(minimum)(domain[0])
  const domainMaximum = numberOrDefault(maximum)(domain[1])
  const count = binCount(plot.points.length)
  const widthValue = binWidth(domainMinimum, domainMaximum, count)
  const indexForValue = binIndex(domainMinimum, domainMaximum, count)
  const centreForValue = (value: number): number =>
    binMidpoint(domainMinimum, widthValue, indexForValue(value))
  const stackAt = stackIndex(plot.points, indexForValue)
  const stackIndexes = plot.points.map(stackAt)
  const dotStep = fittedDotStep(baselineY, margin.top, maximumStackIndex(stackIndexes))
  const tickValues = scaleLinear()
    .domain([minimum, maximum])
    .nice()
    .range([plotLeft, plotRight])
    .ticks(5)

  return {
    plotLeft,
    plotRight,
    plotTop: margin.top,
    plotBottom,
    baselineY,
    xTicks: tickValues.map(renderValueTick(xScale)),
    points: plot.points.map(renderPoint(baselineY, centreForValue, dotStep, stackAt, xScale)),
  }
}
