import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IndexedComparisonChart } from '@/components/charts'
import { validateIndexedComparisonChart } from '@/components/charts/indexed-comparison-chart'
import { buildIndexedComparisonChartModel } from '@/components/charts/indexed-comparison-chart'
import type { IndexedComparisonChartViewModelDto } from '@/shared/dto/comparison'

const chart: IndexedComparisonChartViewModelDto = {
  title: 'USD indexed comparison',
  summary: 'Indexed comparison for USD against EUR and GBP.',
  points: [
    { date: '2026-06-01', quote: 'EUR', indexedValue: 100, displayIndexedValue: '100', actualRate: 1, displayActualRate: '1' },
    { date: '2026-06-08', quote: 'EUR', indexedValue: 102, displayIndexedValue: '102', actualRate: 1.02, displayActualRate: '1.02' },
    { date: '2026-06-01', quote: 'GBP', indexedValue: 100, displayIndexedValue: '100', actualRate: 0.8, displayActualRate: '0.8' },
    { date: '2026-06-08', quote: 'GBP', indexedValue: 101, displayIndexedValue: '101', actualRate: 0.81, displayActualRate: '0.81' },
  ],
  tableCaption: 'USD indexed comparison rows',
}

describe('IndexedComparisonChart', () => {
  it('validates and groups indexed points by quote', () => {
    const result = validateIndexedComparisonChart(chart)

    expect(result).toMatchObject({
      tag: 'success',
      value: {
        series: [
          { quote: 'EUR' },
          { quote: 'GBP' },
        ],
      },
    })
  })

  it('uses D3 model computation to build one path per quote', () => {
    const result = validateIndexedComparisonChart(chart)

    if (result.tag === 'failure') {
      throw new Error(result.error.message)
    }

    const model = buildIndexedComparisonChartModel(result.value, 720, 240)

    expect(model.series).toHaveLength(2)
    expect(model.series[0]?.colour).toBe('var(--cr-chart-series-1)')
    expect(model.series[1]?.colour).toBe('var(--cr-chart-series-2)')
    expect(model.series[0]?.path).toContain('M')
    expect(model.yTicks.length).toBeGreaterThan(0)
  })

  it('renders an accessible chart image', () => {
    render(<IndexedComparisonChart ariaLabel={chart.summary} chart={chart} height={240} width={720} />)

    expect(screen.getByRole('img', { name: chart.summary })).toBeInTheDocument()
    expect(screen.getByText('EUR')).toBeInTheDocument()
    expect(screen.getByText('GBP')).toBeInTheDocument()
  })

  it('keeps x-axis labels sparse for larger date sets', () => {
    const result = validateIndexedComparisonChart({
      ...chart,
      points: Array.from({ length: 30 }, (_value, index) => ({
        date: `2026-06-${String(index + 1).padStart(2, '0')}`,
        quote: 'EUR',
        indexedValue: 100 + index,
        displayIndexedValue: String(100 + index),
        actualRate: 1 + (index / 100),
        displayActualRate: String(1 + (index / 100)),
      })),
    })

    if (result.tag === 'failure') {
      throw new Error(result.error.message)
    }

    const model = buildIndexedComparisonChartModel(result.value, 720, 240)

    expect(model.xTicks.length).toBeLessThanOrEqual(7)
    expect(model.xTicks[0]?.label).toBe('06-01')
    expect(model.xTicks[model.xTicks.length - 1]?.label).toBe('06-30')
  })

  it('reserves enough left-side room for long y-axis labels', () => {
    const result = validateIndexedComparisonChart({
      ...chart,
      points: [
        { date: '2026-06-01', quote: 'EUR', indexedValue: 10000, displayIndexedValue: '10,000', actualRate: 1, displayActualRate: '1' },
        { date: '2026-06-08', quote: 'EUR', indexedValue: 10450, displayIndexedValue: '10,450', actualRate: 1.02, displayActualRate: '1.02' },
      ],
    })

    if (result.tag === 'failure') {
      throw new Error(result.error.message)
    }

    const model = buildIndexedComparisonChartModel(result.value, 720, 240)
    const longestLabelLength = Math.max(...model.yTicks.map((tick) => tick.label.length))

    expect(model.plotLeft).toBeGreaterThan(24)
    expect(model.yLabelX - (longestLabelLength * 7)).toBeGreaterThanOrEqual(0)
  })

  it('shows point details through the point hit area', () => {
    render(<IndexedComparisonChart ariaLabel={chart.summary} chart={chart} height={240} width={720} />)

    fireEvent.mouseEnter(screen.getByRole('img', { name: 'EUR June 8, 2026: index 102, rate 1.02' }))

    expect(screen.getByText('EUR June 8, 2026: index 102, rate 1.02')).toBeInTheDocument()
  })
})
