import { extent, line, scaleLinear, scalePoint } from 'd3'
import type {
  IndexedComparisonSeries,
  IndexedComparisonSeriesPoint,
  ValidatedIndexedComparisonChart,
} from './indexed-comparison-chart.domain'
import { anyTrue, fromNullable, matchBoolean, matchMaybe } from '@/shared/fp'

type ChartExtent = readonly [number, number]

export type IndexedComparisonRenderedPoint = IndexedComparisonSeriesPoint & {
  readonly x: number
  readonly y: number
}

export type IndexedComparisonRenderedSeries = {
  readonly quote: string
  readonly colour: string
  readonly path: string
  readonly points: ReadonlyArray<IndexedComparisonRenderedPoint>
}

export type IndexedComparisonRenderedTick = {
  readonly value: number
  readonly y: number
  readonly label: string
}

export type IndexedComparisonRenderedDateTick = {
  readonly date: string
  readonly x: number
  readonly label: string
}

export type IndexedComparisonChartModel = {
  readonly plotLeft: number
  readonly plotRight: number
  readonly plotTop: number
  readonly plotBottom: number
  readonly yLabelX: number
  readonly xTicks: ReadonlyArray<IndexedComparisonRenderedDateTick>
  readonly yTicks: ReadonlyArray<IndexedComparisonRenderedTick>
  readonly series: ReadonlyArray<IndexedComparisonRenderedSeries>
}

const margin = {
  bottom: 24,
  left: 24,
  right: 24,
  top: 32,
}

const yLabelGap = 8
const yLabelCharacterWidth = 7
const maximumPlotLeftShare = 0.34

const colours: ReadonlyArray<string> = [
  '#155eef',
  '#b42318',
  '#027a48',
  '#7a5af8',
  '#b54708',
  '#088ab2',
  '#c11574',
  '#4e5ba6',
  '#039855',
  '#d444f1',
]

const allPoints = (
  chart: ValidatedIndexedComparisonChart,
): ReadonlyArray<IndexedComparisonSeriesPoint> =>
  chart.series.flatMap((series) => series.points)

const allDates = (
  points: ReadonlyArray<IndexedComparisonSeriesPoint>,
): ReadonlyArray<string> =>
  Array.from(new Set(points.map((point) => point.date)))

const allIndexValues = (
  points: ReadonlyArray<IndexedComparisonSeriesPoint>,
): ReadonlyArray<number> =>
  points.map((point) => point.indexedValue)

const numberOrDefault =
  (fallback: number) =>
  (value: number | undefined): number =>
    matchMaybe<number, number>({
      none: () => fallback,
      some: (numberValue) => numberValue,
    })(fromNullable(value))

const extentOrDefault = (
  values: ReadonlyArray<number>,
): ChartExtent => {
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

const pathFromPoints = (
  points: ReadonlyArray<IndexedComparisonRenderedPoint>,
): string =>
  matchMaybe<string, string>({
    none: () => '',
    some: (path) => path,
  })(
    fromNullable(
      line<IndexedComparisonRenderedPoint>()
        .x((point) => point.x)
        .y((point) => point.y)(points),
    ),
  )

const renderPoint =
  (
    plotLeft: number,
    xScale: (date: string) => number | undefined,
    yScale: (value: number) => number,
  ) =>
  (point: IndexedComparisonSeriesPoint): IndexedComparisonRenderedPoint => ({
    ...point,
    x: numberOrDefault(plotLeft)(xScale(point.date)),
    y: yScale(point.indexedValue),
  })

const renderSeries =
  (
    plotLeft: number,
    xScale: (date: string) => number | undefined,
    yScale: (value: number) => number,
  ) =>
  (series: IndexedComparisonSeries, index: number): IndexedComparisonRenderedSeries => {
    const points = series.points.map(renderPoint(plotLeft, xScale, yScale))
    const colour = matchMaybe<string, string>({
      none: () => '#155eef',
      some: (seriesColour) => seriesColour,
    })(fromNullable(colours[index % colours.length]))

    return {
      quote: series.quote,
      colour,
      path: pathFromPoints(points),
      points,
    }
  }

const renderTick =
  (yScale: (value: number) => number) =>
  (value: number): IndexedComparisonRenderedTick => ({
    value,
    y: yScale(value),
    label: String(Math.round(value)),
  })

const tickLabel = (value: number): string =>
  String(Math.round(value))

const estimatedLabelWidth = (label: string): number =>
  label.length * yLabelCharacterWidth

const requiredPlotLeft = (tickValues: ReadonlyArray<number>): number =>
  Math.max(...tickValues.map((value) => estimatedLabelWidth(tickLabel(value)))) + yLabelGap

const plotLeftForTicks = (
  tickValues: ReadonlyArray<number>,
  width: number,
): number =>
  Math.min(
    Math.max(margin.left, requiredPlotLeft(tickValues)),
    Math.max(margin.left, width * maximumPlotLeftShare),
  )

const dateTickStep = (dates: ReadonlyArray<string>): number =>
  Math.max(1, Math.ceil(dates.length / 6))

const isDateTick =
  (dates: ReadonlyArray<string>, step: number) =>
  (_date: string, index: number): boolean =>
    anyTrue([
      index === 0,
      index === dates.length - 1,
      index % step === 0,
    ])

const shortDateLabel = (date: string): string =>
  date.slice(5)

const renderDateTick =
  (plotLeft: number, xScale: (date: string) => number | undefined) =>
  (date: string): IndexedComparisonRenderedDateTick => ({
    date,
    x: numberOrDefault(plotLeft)(xScale(date)),
    label: shortDateLabel(date),
  })

const renderDateTicks = (
  dates: ReadonlyArray<string>,
  plotLeft: number,
  xScale: (date: string) => number | undefined,
): ReadonlyArray<IndexedComparisonRenderedDateTick> => {
  const step = dateTickStep(dates)

  return dates
    .filter(isDateTick(dates, step))
    .map(renderDateTick(plotLeft, xScale))
}

export const buildIndexedComparisonChartModel = (
  chart: ValidatedIndexedComparisonChart,
  width: number,
  height: number,
): IndexedComparisonChartModel => {
  const points = allPoints(chart)
  const dates = allDates(points)
  const [minimum, maximum] = expandFlatExtent(extentOrDefault(allIndexValues(points)))
  const plotBottom = height - margin.bottom
  const plotRight = width - margin.right
  const yTickValues = scaleLinear()
    .domain([minimum, maximum])
    .nice()
    .range([plotBottom, margin.top])
    .ticks(4)
  const plotLeft = plotLeftForTicks(yTickValues, width)
  const xScale = scalePoint()
    .domain([...dates])
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
    xTicks: renderDateTicks(dates, plotLeft, xScale),
    yTicks: yTickValues.map(renderTick(yScale)),
    series: chart.series.map(renderSeries(plotLeft, xScale, yScale)),
  }
}
