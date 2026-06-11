import { describe, expect, it } from 'vitest'
import { analyse, type AnalysisError } from '@/server/application/analysis/analyse'
import type { PairAnalysisViewModelDto } from '@/shared/dto/analysis'
import type { Result } from '@/shared/fp'
import { countingRateProvider, failingRateProvider, fakeHistoricalRates, successfulRateProvider } from '../../helpers/fake-rate-provider'

const expectSuccess = (
  result: Result<AnalysisError, PairAnalysisViewModelDto>,
): PairAnalysisViewModelDto => {
  if (result.tag === 'failure') {
    throw new Error(`Expected success result, got ${result.error.tag}`)
  }

  return result.value
}

const expectFailure = (
  result: Result<AnalysisError, PairAnalysisViewModelDto>,
): AnalysisError => {
  if (result.tag === 'success') {
    throw new Error('Expected failure result')
  }

  return result.error
}

describe('analyse application service', () => {
  it('builds a pair-analysis view model from historical observations', async () => {
    const result = await analyse({
      exchangeRateProvider: successfulRateProvider(),
      today: '2026-06-09',
    })({
      base: 'USD',
      quote: 'GBP',
      dateRange: { _tag: 'Preset', preset: '7D' },
    })
    const viewModel = expectSuccess(result)

    expect(viewModel.mode).toBe('pair-analysis')
    expect(viewModel.pair.label).toBe('USD/GBP')
    expect(viewModel.metrics.latestReferenceRate.rawValue).toEqual({ _tag: 'Just', value: 0.81 })
    expect(viewModel.dataQuality.status).toBe('complete')
    expect(viewModel.aiContextSeed.mode).toBe('pair-analysis')
    expect(viewModel.calculationExplanations.find((entry) => entry.formulaKey === 'period-movement')?.workedSolutionLatex).toEqual({
      _tag: 'Just',
      value: String.raw`\frac{0.81 - 0.79}{0.79} \times 100 = 2.53\%`,
    })
  })

  it('returns same-currency analysis without calling the provider', async () => {
    const provider = countingRateProvider()
    const result = await analyse({
      exchangeRateProvider: provider,
      today: '2026-06-09',
    })({
      base: 'USD',
      quote: 'USD',
      dateRange: { _tag: 'Preset', preset: '30D' },
    })
    const viewModel = expectSuccess(result)

    expect(viewModel.dataQuality.status).toBe('same-currency')
    expect(viewModel.metrics.periodMovement.availability._tag).toBe('NotApplicable')
    expect(provider.calls()).toBe(0)
  })

  it('represents limited data as a successful analysis state', async () => {
    const result = await analyse({
      exchangeRateProvider: successfulRateProvider(
        undefined,
        fakeHistoricalRates({
          observations: [{ date: '2026-06-08', rate: 0.81 }],
        }),
      ),
      today: '2026-06-09',
    })({
      base: 'USD',
      quote: 'GBP',
      dateRange: { _tag: 'Preset', preset: '7D' },
    })
    const viewModel = expectSuccess(result)

    expect(viewModel.dataQuality.status).toBe('limited-data')
    expect(viewModel.metrics.typicalMovement.availability._tag).toBe('Unavailable')
  })

  it('maps provider failures to analysis errors', async () => {
    const result = await analyse({
      exchangeRateProvider: failingRateProvider({ tag: 'network', message: 'offline' }),
      today: '2026-06-09',
    })({
      base: 'USD',
      quote: 'GBP',
      dateRange: { _tag: 'Preset', preset: '7D' },
    })

    expect(expectFailure(result).tag).toBe('provider-unavailable')
  })
})
