'use client'

import { useMemo } from 'react'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ReactNode } from 'react'
import type { IndexedComparisonChartViewModelDto } from '@/shared/dto/comparison'
import { matchBoolean, matchMaybe, matchResult, none, some, type Maybe } from '@/shared/fp'
import { buildIndexedComparisonChartModel } from './indexed-comparison-chart.model'
import type { IndexedComparisonRenderedPoint } from './indexed-comparison-chart.model'
import type { ValidatedIndexedComparisonChart, IndexedComparisonChartError } from './indexed-comparison-chart.domain'
import { validateIndexedComparisonChart } from './indexed-comparison-chart.domain'

export type IndexedComparisonChartProps = {
  readonly ariaDescribedBy?: string
  readonly ariaLabel: string
  readonly chart: IndexedComparisonChartViewModelDto
  readonly height: number
  readonly width: number
}

const tooltipHeight = 24
const tooltipMinimumWidth = 52
const tooltipPaddingX = 8
const tooltipCharacterWidth = 6.8
const tooltipViewBoxPadding = 4

const activeKey = (point: IndexedComparisonRenderedPoint): string =>
  `${point.quote}:${point.date}`

const tooltipWidth = (label: string): number =>
  Math.max(tooltipMinimumWidth, (label.length * tooltipCharacterWidth) + (tooltipPaddingX * 2))

const clamp = (minimum: number, maximum: number, value: number): number =>
  Math.min(Math.max(value, minimum), maximum)

const pointLabel = (point: IndexedComparisonRenderedPoint): string =>
  `${point.quote} ${point.date}: index ${point.displayIndexedValue}, rate ${point.displayActualRate}`

const noop = (): void => {
  void false
}

function IndexedComparisonTooltip({
  height,
  point,
  width,
}: {
  readonly height: number
  readonly point: IndexedComparisonRenderedPoint
  readonly width: number
}) {
  const label = pointLabel(point)
  const widthValue = tooltipWidth(label)
  const x = clamp(tooltipViewBoxPadding, width - widthValue - tooltipViewBoxPadding, point.x - (widthValue / 2))
  const y = clamp(tooltipViewBoxPadding, height - tooltipHeight - tooltipViewBoxPadding, point.y - tooltipHeight - 10)

  return (
    <g className="comparison-chart__tooltip" aria-hidden="true">
      <rect className="comparison-chart__tooltip-background" x={x} y={y} width={widthValue} height={tooltipHeight} rx={4} />
      <text className="comparison-chart__tooltip-text" x={x + (widthValue / 2)} y={y + (tooltipHeight / 2)} textAnchor="middle">
        {label}
      </text>
    </g>
  )
}

function IndexedComparisonPointMarker({
  activePoint,
  onActivate,
  onDeactivate,
  point,
}: {
  readonly activePoint: Maybe<IndexedComparisonRenderedPoint>
  readonly onActivate: (point: IndexedComparisonRenderedPoint) => void
  readonly onDeactivate: () => void
  readonly point: IndexedComparisonRenderedPoint
}) {
  const active = matchMaybe<IndexedComparisonRenderedPoint, boolean>({
    none: () => false,
    some: (activeValue) => activeKey(activeValue) === activeKey(point),
  })(activePoint)
  const activeClassName = matchBoolean<string>({
    false: () => '',
    true: () => 'comparison-chart__point--active',
  })(active)
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>): void => {
    matchBoolean<() => void>({
      false: () => noop,
      true: () => onDeactivate,
    })(event.key === 'Escape')
      ()
  }

  return (
    <g
      className={`comparison-chart__point ${activeClassName}`}
      role="img"
      aria-label={pointLabel(point)}
      tabIndex={0}
      onBlur={onDeactivate}
      onClick={() => {
        onActivate(point)
      }}
      onFocus={() => {
        onActivate(point)
      }}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => {
        onActivate(point)
      }}
      onMouseLeave={onDeactivate}
    >
      <circle className="comparison-chart__point-hit-area" cx={point.x} cy={point.y} r={10} />
      <circle className="comparison-chart__point-dot" cx={point.x} cy={point.y} r={3.6} />
    </g>
  )
}

export function IndexedComparisonChart({
  ariaDescribedBy,
  ariaLabel,
  chart,
  height,
  width,
}: IndexedComparisonChartProps) {
  const result = useMemo(() => validateIndexedComparisonChart(chart), [chart])
  const [activePoint, setActivePoint] = useState<Maybe<IndexedComparisonRenderedPoint>>(none())

  return matchResult<IndexedComparisonChartError, ValidatedIndexedComparisonChart, ReactNode>({
    failure: (error): ReactNode => (
      <div className="comparison-chart__error" role="alert">
        <strong>Chart unavailable</strong>
        <p>{error.message}</p>
      </div>
    ),
    success: (validatedChart): ReactNode => {
      const model = buildIndexedComparisonChartModel(validatedChart, width, height)

      return (
        <div className="chart-panel__visual cr-chart-panel__visual comparison-chart cr-comparison-chart">
          <svg
            className="comparison-chart__svg"
            viewBox={`0 0 ${String(width)} ${String(height)}`}
            role="img"
            aria-describedby={ariaDescribedBy}
            aria-label={ariaLabel}
          >
            <line className="comparison-chart__axis" x1={model.plotLeft} x2={model.plotRight} y1={model.plotBottom} y2={model.plotBottom} />
            <line className="comparison-chart__axis" x1={model.plotLeft} x2={model.plotLeft} y1={model.plotTop} y2={model.plotBottom} />
            {model.yTicks.map((tick) => (
              <g className="comparison-chart__tick" key={tick.value}>
                <line x1={model.plotLeft} x2={model.plotRight} y1={tick.y} y2={tick.y} />
                <text x={model.yLabelX} y={tick.y} textAnchor="end">{tick.label}</text>
              </g>
            ))}
            {model.xTicks.map((tick) => (
              <g className="comparison-chart__tick" key={tick.date}>
                <line x1={tick.x} x2={tick.x} y1={model.plotTop} y2={model.plotBottom} />
                <text x={tick.x} y={height - 6} textAnchor="middle">{tick.label}</text>
              </g>
            ))}
            {model.series.map((series) => (
              <path
                className="comparison-chart__line"
                d={series.path}
                key={series.quote}
                stroke={series.colour}
              />
            ))}
            {model.series.flatMap((series) =>
              series.points.map((point) => (
                <IndexedComparisonPointMarker
                  activePoint={activePoint}
                  key={activeKey(point)}
                  onActivate={(nextPoint) => {
                    setActivePoint(some(nextPoint))
                  }}
                  onDeactivate={() => {
                    setActivePoint(none())
                  }}
                  point={point}
                />
              )),
            )}
            {matchMaybe<IndexedComparisonRenderedPoint, ReactNode>({
              none: () => null,
              some: (point) => <IndexedComparisonTooltip height={height} point={point} width={width} />,
            })(activePoint)}
          </svg>
          <div className="comparison-chart__legend" aria-hidden="true">
            {model.series.map((series) => (
              <span key={series.quote}>
                <span style={{ background: series.colour }} />
                {series.quote}
              </span>
            ))}
          </div>
        </div>
      )
    },
  })(result)
}
