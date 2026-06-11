import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnalyseCard } from '@/components/analysis/analyse-card'
import type { AnalysisMetricValueDto, PairAnalysisViewModelDto } from '@/shared/dto/analysis'

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

const unavailableMetric = (metricKey: AnalysisMetricValueDto['metricKey']): AnalysisMetricValueDto => ({
  _tag: 'AnalysisMetricValue',
  metricKey,
  rawValue: { _tag: 'Nothing' },
  displayValue: { _tag: 'Nothing' },
  unit: { _tag: 'Nothing' },
  availability: {
    _tag: 'Unavailable',
    reason: 'Not enough usable historical observations for this metric.',
  },
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
      workedSolutionLatex: { _tag: 'Just', value: String.raw`r_{\mathrm{latest}} = r_n = 171` },
      steps: ['Use latest rate.'],
      result: metric('latest-reference-rate', '171'),
      interpretation: 'Historical reference rate.',
      caveat: { _tag: 'Nothing' },
      unavailableReason: { _tag: 'Nothing' },
    },
    {
      formulaKey: 'period-movement',
      metricKey: 'period-movement',
      title: 'Period movement',
      plainMeaning: 'The rate moved from first to latest.',
      latexFormula: String.raw`\frac{r_n - r_1}{r_1} \times 100`,
      accessibleText: 'Period movement.',
      workedSolutionLatex: { _tag: 'Just', value: String.raw`\frac{171 - 170}{170} \times 100 = 0.59\%` },
      steps: ['Compare first and latest rate.'],
      result: metric('period-movement', '0.59%'),
      interpretation: 'Observed movement over the period.',
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

const noDataViewModel: PairAnalysisViewModelDto = {
  ...successViewModel,
  chart: {
    ...successViewModel.chart,
    points: [],
    summary: 'No usable historical observations were found for EUR/JPY.',
  },
  dataQuality: {
    status: 'no-data',
    requestedObservationCount: 2,
    usableObservationCount: 0,
    excludedObservationCount: 2,
    firstObservationDate: { _tag: 'Nothing' },
    latestObservationDate: { _tag: 'Nothing' },
    messages: ['No usable historical observations were returned for the selected period.'],
  },
  metrics: {
    latestReferenceRate: unavailableMetric('latest-reference-rate'),
    periodMovement: unavailableMetric('period-movement'),
    averageRate: unavailableMetric('average-rate'),
    observedRange: unavailableMetric('observed-range'),
    latestPosition: unavailableMetric('latest-position'),
    awayFromTypical: unavailableMetric('away-from-typical'),
    typicalMovement: unavailableMetric('typical-movement'),
  },
  calculationExplanations: successViewModel.calculationExplanations.map((explanation) => ({
    ...explanation,
    result: unavailableMetric(explanation.metricKey),
    unavailableReason: { _tag: 'Just', value: 'Not enough usable historical observations for this metric.' },
    workedSolutionLatex: { _tag: 'Nothing' },
  })),
  insight: 'No usable historical observations were returned for the selected period.',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AnalyseCard', () => {
  it('seeds currencies from props', () => {
    render(<AnalyseCard currencyCodes={currencyCodes} initialBase="EUR" initialQuote="JPY" />)

    expect(screen.getByLabelText('Base')).toHaveValue('EUR')
    expect(screen.getByLabelText('Quote')).toHaveValue('JPY')
    expect(screen.getByLabelText('Period to analyse')).toHaveValue('30D')
    expect(screen.getByText('Choose a pair and date range to analyse.')).toBeInTheDocument()
  })

  it('shows the loading state while analysis is pending', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)))

    render(<AnalyseCard currencyCodes={currencyCodes} initialBase="EUR" initialQuote="JPY" />)
    fireEvent.click(screen.getByRole('button', { name: 'Analyse' }))

    expect(screen.getByRole('status')).toHaveTextContent('Loading historical reference rates.')
    expect(screen.getByRole('button', { name: 'Analyse' })).toBeDisabled()
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
    expect(screen.queryByText('Chart ready')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Cleaned observations' })).toHaveClass('analysis-result__observations')
    expect(screen.getByRole('img', { name: 'EUR/JPY cleaned observations dot plot' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'EUR/JPY cleaned observations' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Analysis summary' })).toBeInTheDocument()
    expect(screen.getByText('Latest rate')).toBeInTheDocument()
    expect(screen.getByText('Variability')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Latest reference rate'))
    expect(screen.getByLabelText('Latest rate.')).toBeInTheDocument()
    expect(screen.getByLabelText('Worked solution for Latest reference rate.')).toBeInTheDocument()
    expect(screen.queryByText('Caveat')).not.toBeInTheDocument()
  })

  it('keeps only one formula card expanded at a time', async () => {
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
      expect(screen.getByRole('region', { name: 'Analysis summary' })).toBeInTheDocument()
    })

    const latestTitle = screen.getByText('Latest reference rate', { selector: '.formula-card__title' })
    const periodTitle = screen.getByText('Period movement', { selector: '.formula-card__title' })
    const latestFormula = latestTitle.closest('details')
    const periodFormula = periodTitle.closest('details')

    fireEvent.click(latestTitle)
    expect(latestFormula).toHaveAttribute('open')
    expect(periodFormula).not.toHaveAttribute('open')

    fireEvent.click(periodTitle)
    expect(latestFormula).not.toHaveAttribute('open')
    expect(periodFormula).toHaveAttribute('open')
  })

  it('renders no-data and empty chart states without dropping result sections', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ _tag: 'ApiSuccess', data: noDataViewModel }), {
          status: 200,
        }),
      ),
    ))

    render(<AnalyseCard currencyCodes={currencyCodes} initialBase="EUR" initialQuote="JPY" />)
    fireEvent.click(screen.getByRole('button', { name: 'Analyse' }))

    await waitFor(() => {
      expect(screen.getByText('No cleaned observations to chart.')).toBeInTheDocument()
    })
    expect(screen.getByText('Need at least two cleaned observations to plot.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Analysis summary' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Data quality' })).toHaveTextContent('No usable historical observations were returned for the selected period.')
    expect(screen.queryByRole('table', { name: 'EUR/JPY cleaned observations' })).not.toBeInTheDocument()
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
