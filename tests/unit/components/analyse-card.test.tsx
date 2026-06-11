import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnalyseCard } from '@/components/analysis/analyse-card'
import type { PairAnalysisViewModelDto } from '@/shared/dto/analysis'

const currencyCodes = ['EUR', 'JPY', 'USD']

const metric = (metricKey: PairAnalysisViewModelDto['metrics']['latestReferenceRate']['metricKey'], displayValue: string) => ({
  _tag: 'AnalysisMetricValue' as const,
  metricKey,
  rawValue: { _tag: 'Just' as const, value: 1 },
  displayValue: { _tag: 'Just' as const, value: displayValue },
  unit: { _tag: 'Just' as const, value: 'rate' as const },
  availability: { _tag: 'Available' as const },
  warnings: [],
})

const successViewModel: PairAnalysisViewModelDto = {
  mode: 'pair-analysis',
  pair: {
    base: { code: 'EUR', name: 'Euro' },
    quote: { code: 'JPY', name: 'Japanese yen' },
    label: 'EUR/JPY',
  },
  dateRange: {
    requested: { startDate: '2026-06-01', endDate: '2026-06-08', source: 'preset-7d' },
    effective: { startDate: '2026-06-01', endDate: '2026-06-08', aligned: false, note: { _tag: 'Nothing' } },
  },
  chart: {
    title: 'EUR/JPY reference-rate history',
    summary: 'EUR/JPY has 2 usable historical observations in the selected period.',
    points: [
      { date: '2026-06-01', rate: 170, displayRate: '170' },
      { date: '2026-06-08', rate: 171, displayRate: '171' },
    ],
    tableCaption: 'EUR/JPY cleaned observations',
  },
  metrics: {
    latestReferenceRate: metric('latest-reference-rate', '171'),
    periodMovement: metric('period-movement', '0.59%'),
    averageRate: metric('average-rate', '170.5'),
    observedRange: metric('observed-range', '1'),
    latestPosition: metric('latest-position', '100.00%'),
    awayFromTypical: metric('away-from-typical', '1.00'),
    typicalMovement: metric('typical-movement', '0.59%'),
  },
  dataQuality: {
    status: 'complete',
    requestedObservationCount: 2,
    usableObservationCount: 2,
    excludedObservationCount: 0,
    firstObservationDate: { _tag: 'Just', value: '2026-06-01' },
    latestObservationDate: { _tag: 'Just', value: '2026-06-08' },
    messages: ['All returned observations were usable.'],
  },
  insight: 'All returned observations were usable.',
  calculationExplanations: [
    {
      formulaKey: 'latest-reference-rate',
      metricKey: 'latest-reference-rate',
      title: 'Latest reference rate',
      plainMeaning: 'The latest observation.',
      latexFormula: 'r_n',
      accessibleText: 'Latest rate.',
      steps: ['Use latest rate.'],
      result: metric('latest-reference-rate', '171'),
      interpretation: 'Historical reference rate.',
      caveat: { _tag: 'Nothing' },
      unavailableReason: { _tag: 'Nothing' },
    },
  ],
  caveats: [],
  attribution: {
    label: 'Exchange-rate data powered by Frankfurter.',
    sourceName: 'Frankfurter',
    sourceUrl: 'https://www.frankfurter.app/',
  },
  aiContextSeed: {
    mode: 'pair-analysis',
    selectedCurrencies: { base: 'EUR', quotes: ['JPY'] },
    selectedDateRange: { _tag: 'Just', value: { startDate: '2026-06-01', endDate: '2026-06-08', aligned: false, note: { _tag: 'Nothing' } } },
    keyResults: [],
    computedStats: { _tag: 'Just', value: { observationCount: 2, dataQualityStatus: 'complete' } },
    chartSummary: { _tag: 'Just', value: 'EUR/JPY has 2 usable historical observations in the selected period.' },
    formulaSummaries: [],
    appDisclaimers: [],
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AnalyseCard', () => {
  it('seeds currencies from props', () => {
    render(<AnalyseCard currencyCodes={currencyCodes} initialBase="EUR" initialQuote="JPY" />)

    expect(screen.getByLabelText('Base')).toHaveValue('EUR')
    expect(screen.getByLabelText('Quote')).toHaveValue('JPY')
  })

  it('submits input and displays the server analysis result', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ _tag: 'ApiSuccess', data: successViewModel }), {
          status: 200,
        }),
      ),
    ))

    render(<AnalyseCard currencyCodes={currencyCodes} initialBase="EUR" initialQuote="JPY" />)
    fireEvent.click(screen.getByRole('button', { name: 'Analyse' }))

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'EUR/JPY reference-rate history' })).toHaveClass('cr-chart-panel')
    })
    expect(screen.getByText('Chart ready')).toHaveClass('cr-chart-panel__status')
    expect(screen.getByText('EUR/JPY cleaned observations')).toBeInTheDocument()
    expect(screen.getByLabelText('Latest rate.')).toBeInTheDocument()
  })

  it('shows provider errors from the analysis API', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            _tag: 'ApiFailure',
            error: {
              code: 'PROVIDER_UNAVAILABLE',
              category: 'provider',
              message: 'Provider unavailable.',
              recoverable: true,
              fieldErrors: [],
              details: [],
            },
          }),
          { status: 503 },
        ),
      ),
    ))

    render(<AnalyseCard currencyCodes={currencyCodes} initialBase="EUR" initialQuote="JPY" />)
    fireEvent.click(screen.getByRole('button', { name: 'Analyse' }))

    expect(await screen.findByText('Provider unavailable.')).toBeInTheDocument()
  })
})
