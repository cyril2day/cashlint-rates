import { describe, expect, it } from 'vitest'
import { buildDotPlotModel } from '@/components/charts/dot-plot'
import type { ValidatedDotPlot } from '@/components/charts/dot-plot/dot-plot.domain'

const densePoint = (index: number) => ({
  id: `point-${index.toString()}`,
  xLabel: `Observation ${index.toString()}`,
  yValue: 1,
  displayYValue: '1',
  ariaLabel: `Observation ${index.toString()}: 1`,
})

const densePlot = (pointCount: number): ValidatedDotPlot => ({
  points: Array.from({ length: pointCount }, (_, index) => densePoint(index)),
})

describe('buildDotPlotModel', () => {
  it('keeps dense stacked points inside the plot area', () => {
    const model = buildDotPlotModel(densePlot(80), 520, 220)
    const topPointY = Math.min(...model.points.map((point) => point.y))

    expect(topPointY).toBeGreaterThanOrEqual(model.plotTop)
  })

  it('keeps the default stack spacing when points already fit', () => {
    const model = buildDotPlotModel(densePlot(2), 520, 220)
    const yPositions = model.points.map((point) => point.y)

    expect(yPositions).toEqual([model.baselineY, model.baselineY - 11])
  })
})
