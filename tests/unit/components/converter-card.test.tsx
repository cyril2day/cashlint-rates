import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageMemoryProvider } from '@/components/page-memory'
import { ConverterDashboard } from '@/components/conversion/converter-card'
import type { ConversionViewModelDto } from '@/shared/dto/conversion'

const successViewModel: ConversionViewModelDto = {
  mode: 'conversion',
  amount: {
    rawAmount: 1000,
    displayAmount: '$1,000.00',
    currency: 'USD',
  },
  base: {
    code: 'USD',
    name: 'US dollar',
  },
  quote: {
    code: 'GBP',
    name: 'British pound',
  },
  result: {
    convertedAmount: {
      _tag: 'MetricAvailable',
      metricKey: 'converted-amount',
      rawValue: 800,
      displayValue: '£800.00',
      unit: 'currency',
      warnings: [],
    },
    effectiveDate: {
      _tag: 'Just',
      value: '2026-06-08',
    },
    rate: {
      _tag: 'MetricAvailable',
      metricKey: 'latest-reference-rate',
      rawValue: 0.8,
      displayValue: '0.8',
      unit: 'rate',
      warnings: [],
    },
    rateDerivation: {
      _tag: 'DirectRate',
      requestedPair: 'USD/GBP',
      sourcePair: 'USD/GBP',
      displayedPair: 'USD/GBP',
    },
  },
  insight: 'Latest available reference rate: 1 USD = 0.8 GBP.',
  actions: {
    analysePair: {
      href: '/analyse?base=USD&quote=GBP',
      base: 'USD',
      quote: 'GBP',
    },
    compareBase: {
      href: '/compare?base=USD&quote=GBP',
      base: 'USD',
      quote: 'GBP',
    },
  },
  attribution: {
    label: 'Exchange-rate data powered by Frankfurter.',
    sourceName: 'Frankfurter',
    sourceUrl: 'https://www.frankfurter.app/',
  },
  aiContextSeed: {
    mode: 'conversion',
    selectedCurrencies: {
      base: 'USD',
      quotes: ['GBP'],
    },
    selectedDateRange: { _tag: 'Nothing' },
    keyResults: [],
    computedStats: { _tag: 'Nothing' },
    chartSummary: { _tag: 'Nothing' },
    formulaSummaries: [],
    appDisclaimers: [],
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

function ConverterMemoryHarness() {
  const [visible, setVisible] = useState(true)

  return (
    <PageMemoryProvider>
      <button
        type="button"
        onClick={() => {
          setVisible((current) => !current)
        }}
      >
        Toggle converter
      </button>
      {visible ? <ConverterDashboard /> : null}
    </PageMemoryProvider>
  )
}

describe('ConverterCard', () => {
  it('renders the initial state', () => {
    render(<ConverterDashboard />)

    expect(screen.getByRole('form', { name: 'Currency converter' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ready for a conversion' })).toBeInTheDocument()
    expect(screen.getByText('Enter an amount, then choose the currencies to compare.')).toBeInTheDocument()
    expect(screen.getByText('Use a positive amount for this conversion.')).toBeInTheDocument()
  })

  it('submits input and displays the server conversion result', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ _tag: 'ApiSuccess', data: successViewModel }), {
          status: 200,
        }),
      ),
    ))

    render(<ConverterDashboard />)
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }))

    await waitFor(() => {
      expect(screen.getByText(/\$1,000.00 USD = £800.00 GBP/)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Analyse this pair' })).toHaveAttribute(
      'href',
      '/analyse?base=USD&quote=GBP',
    )
    expect(screen.getByRole('link', { name: 'Compare this base' })).toHaveAttribute(
      'href',
      '/compare?base=USD&quote=GBP',
    )
    expect(screen.getByText('Effective date: June 8, 2026')).toBeInTheDocument()
    expect(screen.queryByText('Questions about this result')).not.toBeInTheDocument()
  })

  it('remembers the last conversion result after the page remounts', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ _tag: 'ApiSuccess', data: successViewModel }), {
          status: 200,
        }),
      ),
    ))

    render(<ConverterMemoryHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }))

    await waitFor(() => {
      expect(screen.getByText(/\$1,000.00 USD = £800.00 GBP/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Toggle converter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toggle converter' }))

    expect(screen.getByText(/\$1,000.00 USD = £800.00 GBP/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compare this base' })).toHaveAttribute(
      'href',
      '/compare?base=USD&quote=GBP',
    )
  })

  it('shows the loading state while conversion is pending', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)))

    render(<ConverterDashboard />)
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }))

    expect(screen.getByRole('status')).toHaveTextContent('Loading latest reference rate.')
    expect(screen.getByRole('button', { name: 'Convert' })).toBeDisabled()
  })

  it('swaps the selected currencies', () => {
    render(<ConverterDashboard />)

    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))

    expect(screen.getByLabelText('From')).toHaveValue('GBP')
    expect(screen.getByLabelText('To')).toHaveValue('USD')
  })

  it('shows client-side validation for invalid amounts', async () => {
    render(<ConverterDashboard />)
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '-5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }))

    const alert = await screen.findByRole('alert')

    expect(within(alert).getByText('Invalid amount')).toBeInTheDocument()
    expect(within(alert).getByText('Use a positive amount for this conversion.')).toBeInTheDocument()
  })
})
