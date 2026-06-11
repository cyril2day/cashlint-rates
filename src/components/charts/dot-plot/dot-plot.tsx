'use client'

import { useMemo, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { chainMaybe, fromNullable, matchBoolean, matchMaybe, matchResult, none, some, type Maybe } from '@/shared/fp'
import { buildDotPlotModel, type DotPlotRenderedPoint } from './dot-plot.model'
import { validateDotPlot, type DotPlotError, type DotPlotInput, type ValidatedDotPlot } from './dot-plot.domain'

export type DotPlotProps = {
  readonly ariaDescribedBy?: string
  readonly ariaLabel: string
  readonly className?: string
  readonly height: number
  readonly plot: DotPlotInput
  readonly width: number
}

const tooltipHeight = 24
const tooltipMinimumWidth = 52
const tooltipPaddingX = 8
const tooltipCharacterWidth = 6.8
const tooltipViewBoxPadding = 4

const activeKey = (point: DotPlotRenderedPoint): string =>
  point.id

const tooltipWidth = (label: string): number =>
  Math.max(tooltipMinimumWidth, (label.length * tooltipCharacterWidth) + (tooltipPaddingX * 2))

const clamp = (minimum: number, maximum: number, value: number): number =>
  Math.min(Math.max(value, minimum), maximum)

const noop = (): void => {
  void false
}

const baseClassName = 'chart-panel__visual cr-chart-panel__visual dot-plot cr-dot-plot'

const maybeClassName = (className: string | undefined): Maybe<string> =>
  chainMaybe((value: string) =>
    matchBoolean<Maybe<string>>({
      false: () => none(),
      true: () => some(value.trim()),
    })(value.trim().length > 0),
  )(fromNullable(className))

const rootClassName = (className: string | undefined): string =>
  matchMaybe<string, string>({
    none: () => baseClassName,
    some: (value) => `${baseClassName} ${value}`,
  })(maybeClassName(className))

function DotPlotTooltip({
  height,
  point,
  width,
}: {
  readonly height: number
  readonly point: DotPlotRenderedPoint
  readonly width: number
}) {
  const label = point.ariaLabel
  const widthValue = tooltipWidth(label)
  const x = clamp(tooltipViewBoxPadding, width - widthValue - tooltipViewBoxPadding, point.x - (widthValue / 2))
  const y = clamp(tooltipViewBoxPadding, height - tooltipHeight - tooltipViewBoxPadding, point.y - tooltipHeight - 10)

  return (
    <g className="dot-plot__tooltip" aria-hidden="true">
      <rect className="dot-plot__tooltip-background" x={x} y={y} width={widthValue} height={tooltipHeight} rx={4} />
      <text className="dot-plot__tooltip-text" x={x + (widthValue / 2)} y={y + (tooltipHeight / 2)} textAnchor="middle">
        {label}
      </text>
    </g>
  )
}

function DotPlotPointMarker({
  activePoint,
  onActivate,
  onDeactivate,
  point,
}: {
  readonly activePoint: Maybe<DotPlotRenderedPoint>
  readonly onActivate: (point: DotPlotRenderedPoint) => void
  readonly onDeactivate: () => void
  readonly point: DotPlotRenderedPoint
}) {
  const active = matchMaybe<DotPlotRenderedPoint, boolean>({
    none: () => false,
    some: (activeValue) => activeKey(activeValue) === activeKey(point),
  })(activePoint)
  const activeClassName = matchBoolean<string>({
    false: () => '',
    true: () => 'dot-plot__point--active',
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
      className={`dot-plot__point ${activeClassName}`}
      role="img"
      aria-label={point.ariaLabel}
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
      <circle className="dot-plot__point-hit-area" cx={point.x} cy={point.y} r={10} />
      <circle className="dot-plot__point-dot" cx={point.x} cy={point.y} r={4} />
    </g>
  )
}

export function DotPlot({
  ariaDescribedBy,
  ariaLabel,
  className,
  height,
  plot,
  width,
}: DotPlotProps) {
  const result = useMemo(() => validateDotPlot(plot), [plot])
  const [activePoint, setActivePoint] = useState<Maybe<DotPlotRenderedPoint>>(none())

  return matchResult<DotPlotError, ValidatedDotPlot, ReactNode>({
    failure: (error): ReactNode => (
      <div className="dot-plot__error" role="alert">
        <strong>Chart unavailable</strong>
        <p>{error.message}</p>
      </div>
    ),
    success: (validatedPlot): ReactNode => {
      const model = buildDotPlotModel(validatedPlot, width, height)

      return (
        <div className={rootClassName(className)}>
          <svg
            className="dot-plot__svg"
            viewBox={`0 0 ${String(width)} ${String(height)}`}
            role="img"
            aria-describedby={ariaDescribedBy}
            aria-label={ariaLabel}
          >
            <line className="dot-plot__axis" x1={model.plotLeft} x2={model.plotRight} y1={model.plotBottom} y2={model.plotBottom} />
            {model.xTicks.map((tick) => (
              <g className="dot-plot__tick" key={tick.value}>
                <line x1={tick.x} x2={tick.x} y1={model.plotBottom - 7} y2={model.plotBottom + 7} />
                <text x={tick.x} y={height - 8} textAnchor="middle">{tick.label}</text>
              </g>
            ))}
            {model.points.map((point) => (
              <DotPlotPointMarker
                activePoint={activePoint}
                key={point.id}
                onActivate={(nextPoint) => {
                  setActivePoint(some(nextPoint))
                }}
                onDeactivate={() => {
                  setActivePoint(none())
                }}
                point={point}
              />
            ))}
            {matchMaybe<DotPlotRenderedPoint, ReactNode>({
              none: () => null,
              some: (point) => <DotPlotTooltip height={height} point={point} width={width} />,
            })(activePoint)}
          </svg>
        </div>
      )
    },
  })(result)
}
