import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompareCard } from '@/components/comparison/compare-card'
import type { ComparisonQuoteRowDto, ComparisonViewModelDto } from '@/shared/dto/comparison'

const currencyCodes = ['EUR', 'GBP', 'JPY', 'USD']

const metric = (
  metricKey: 'latest-reference-rate' | 'period-movement' | 'relative-variability',
  displayValue: string,
) => ({
  _tag: 'ComparisonMetricValue' as const,
  metricKey,
  rawValue: { _tag: 'Just' as const, value: 1 },
  displayValue: { _tag: 'Just' as const, value: displayValue },
  unit: { _tag: 'Just' as const, value: 'percent' as const },
  availability: { _tag: 'Available' as const },
  warnings: [],
})

const unavailableMetric = (
  metricKey: 'latest-reference-rate' | 'period-movement' | 'relative-variability',
  reason: string,
) => ({
  _tag: 'ComparisonMetricValue' as const,
  metricKey,
  rawValue: { _tag: 'Nothing' as const },
  displayValue: { _tag: 'Nothing' as const },
  unit: { _tag: 'Nothing' as const },
  availability: { _tag: 'Unavailable' as const, reason },
  warnings: [],
})

const successViewModel: ComparisonViewModelDto = {
  mode: 'comparison',
  base: { code: 'USD', name: 'US dollar' },
  quotes: [
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'Pound sterling' },
  ],
  dateRange: {
    requested: { startDate: '2026-06-01', endDate: '2026-06-08', source: 'preset-7d' },
    effective: { startDate: '2026-06-01', endDate: '2026-06-08', aligned: false, note: { _tag: 'Nothing' } },
  },
  chart: {
    title: 'USD indexed comparison',
    summary: 'Indexed comparison for USD against 2 quotes.',
    points: [
      { date: '2026-06-01', quote: 'EUR', indexedValue: 100, displayIndexedValue: '100', actualRate: 1, displayActualRate: '1' },
      { date: '2026-06-08', quote: 'EUR', indexedValue: 102, displayIndexedValue: '102', actualRate: 1.02, displayActualRate: '1.02' },
      { date: '2026-06-01', quote: 'GBP', indexedValue: 100, displayIndexedValue: '100', actualRate: 0.8, displayActualRate: '0.8' },
      { date: '2026-06-08', quote: 'GBP', indexedValue: 101, displayIndexedValue: '101', actualRate: 0.81, displayActualRate: '0.81' },
    ],
    tableCaption: 'USD indexed comparison rows',
  },
  rows: [
    {
      quote: { code: 'EUR', name: 'Euro' },
      latestReferenceRate: metric('latest-reference-rate', '1.02'),
      periodMovement: metric('period-movement', '2.00%'),
      relativeVariability: metric('relative-variability', '1.00%'),
      inclusion: { _tag: 'IncludedInRankings' },
      dataQuality: {
        status: 'complete',
        requestedObservationCount: 2,
        usableObservationCount: 2,
        excludedObservationCount: 0,
        firstObservationDate: { _tag: 'Just', value: '2026-06-01' },
        latestObservationDate: { _tag: 'Just', value: '2026-06-08' },
        messages: ['All returned observations were usable.'],
      },
    },
    {
      quote: { code: 'GBP', name: 'Pound sterling' },
      latestReferenceRate: metric('latest-reference-rate', '0.81'),
      periodMovement: metric('period-movement', '1.00%'),
      relativeVariability: metric('relative-variability', '0.50%'),
      inclusion: { _tag: 'IncludedInRankings' },
      dataQuality: {
        status: 'complete',
        requestedObservationCount: 2,
        usableObservationCount: 2,
        excludedObservationCount: 0,
        firstObservationDate: { _tag: 'Just', value: '2026-06-01' },
        latestObservationDate: { _tag: 'Just', value: '2026-06-08' },
        messages: ['All returned observations were usable.'],
      },
    },
  ],
  rankings: {
    mostStableQuote: { _tag: 'Just', value: { quote: { code: 'GBP', name: 'Pound sterling' }, metric: metric('relative-variability', '0.50%'), rank: 1 } },
    mostVariableQuote: { _tag: 'Just', value: { quote: { code: 'EUR', name: 'Euro' }, metric: metric('relative-variability', '1.00%'), rank: 1 } },
    periodMovementAscending: [
      { quote: { code: 'GBP', name: 'Pound sterling' }, metric: metric('period-movement', '1.00%'), rank: 1 },
    ],
    periodMovementDescending: [
      { quote: { code: 'EUR', name: 'Euro' }, metric: metric('period-movement', '2.00%'), rank: 1 },
    ],
  },
  dataQuality: {
    overall: {
      status: 'complete',
      requestedObservationCount: 4,
      usableObservationCount: 4,
      excludedObservationCount: 0,
      firstObservationDate: { _tag: 'Just', value: '2026-06-01' },
      latestObservationDate: { _tag: 'Just', value: '2026-06-08' },
      messages: ['All returned observations were usable.'],
    },
    byQuote: [],
  },
  insight: 'GBP was the most stable quote over the selected period.',
  calculationExplanations: [],
  caveats: ['Each comparison line starts at 100.'],
  attribution: {
    label: 'Exchange-rate data powered by Frankfurter.',
    sourceName: 'Frankfurter',
    sourceUrl: 'https://www.frankfurter.app/',
  },
  aiContextSeed: {
    mode: 'comparison',
    selectedCurrencies: { base: 'USD', quotes: ['EUR', 'GBP'] },
    selectedDateRange: { _tag: 'Just', value: { startDate: '2026-06-01', endDate: '2026-06-08', aligned: false, note: { _tag: 'Nothing' } } },
    keyResults: [],
    computedStats: { _tag: 'Just', value: { rankableQuoteCount: 2, dataQualityStatus: 'complete' } },
    chartSummary: { _tag: 'Just', value: 'Indexed comparison for USD against 2 quotes.' },
    formulaSummaries: [],
    appDisclaimers: [],
  },
}

const noRankableRow: ComparisonQuoteRowDto = {
  quote: { code: 'EUR', name: 'Euro' },
  latestReferenceRate: metric('latest-reference-rate', '1.02'),
  periodMovement: metric('period-movement', '2.00%'),
  relativeVariability: unavailableMetric('relative-variability', 'Not enough usable historical observations.'),
  inclusion: { _tag: 'ExcludedFromRankings', reason: 'partial-data' },
  dataQuality: {
    status: 'partial-data',
    requestedObservationCount: 2,
    usableObservationCount: 2,
    excludedObservationCount: 1,
    firstObservationDate: { _tag: 'Just', value: '2026-06-01' },
    latestObservationDate: { _tag: 'Just', value: '2026-06-08' },
    messages: ['Some provider observations were excluded because they were missing or invalid.'],
  },
}

const noRankableViewModel: ComparisonViewModelDto = {
  ...successViewModel,
  rows: [
    noRankableRow,
  ],
  rankings: {
    mostStableQuote: { _tag: 'Nothing' },
    mostVariableQuote: { _tag: 'Nothing' },
    periodMovementAscending: [],
    periodMovementDescending: [],
  },
  insight: 'No quote had enough complete data for rankings.',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CompareCard', () => {
  it('seeds base and selected quote chips from props', () => {
    render(<CompareCard currencyCodes={currencyCodes} initialBase="USD" initialQuotes={['EUR', 'GBP']} />)

    expect(screen.getByLabelText('Base')).toHaveValue('USD')
    expect(within(screen.getByLabelText('Selected quote currencies')).getByText('EUR')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Selected quote currencies')).getByText('GBP')).toBeInTheDocument()
  })

  it('submits input and displays rankings, chart, and comparison table', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ _tag: 'ApiSuccess', data: successViewModel }), {
          status: 200,
        }),
      ),
    ))

    render(<CompareCard currencyCodes={currencyCodes} initialBase="USD" initialQuotes={['EUR', 'GBP']} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))

    await waitFor(() => {
      expect(screen.getByText('Most stable')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Indexed comparison for USD against 2 quotes.')).toBeInTheDocument()
    expect(screen.getByText('USD indexed comparison rows')).toBeInTheDocument()
    expect(screen.getAllByText('Included in rankings')).toHaveLength(2)
  })

  it('keeps partial rows visible when no quote is rankable', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ _tag: 'ApiSuccess', data: noRankableViewModel }), {
          status: 200,
        }),
      ),
    ))

    render(<CompareCard currencyCodes={currencyCodes} initialBase="USD" initialQuotes={['EUR']} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))

    expect(await screen.findByText('No rankable data')).toBeInTheDocument()
    expect(screen.getAllByText('partial data')).toHaveLength(2)
    expect(screen.getByText('Some provider observations were excluded because they were missing or invalid.')).toBeInTheDocument()
  })

  it('shows comparison API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            _tag: 'ApiFailure',
            error: {
              code: 'NO_QUOTES_SELECTED',
              category: 'validation',
              message: 'Select at least one quote currency to compare.',
              recoverable: true,
              fieldErrors: [],
              details: [],
            },
          }),
          { status: 400 },
        ),
      ),
    ))

    render(<CompareCard currencyCodes={currencyCodes} initialBase="USD" initialQuotes={['EUR']} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))

    expect(await screen.findByText('Select at least one quote currency to compare.')).toBeInTheDocument()
  })
})
