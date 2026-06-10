import type { BogartResultContextDto } from '@/shared/dto/bogart'

export const pairAnalysisBogartContext = (): BogartResultContextDto => ({
  appDisclaimers: [
    'Reference rates may differ from live market, bank, card or payment-service rates.',
  ],
  chartSummary: {
    _tag: 'Just',
    value: 'USD/GBP has 7 usable historical observations in the selected period.',
  },
  computedStats: {
    _tag: 'Just',
    value: {
      dataQualityStatus: 'complete',
      observationCount: 7,
    },
  },
  formulaSummaries: [],
  keyResults: [
    {
      key: 'latest-reference-rate',
      label: 'Latest reference rate',
      value: '0.7900 GBP',
    },
    {
      key: 'period-movement',
      label: 'Period movement',
      value: '1.20%',
    },
  ],
  mode: 'pair-analysis',
  selectedCurrencies: {
    base: 'USD',
    quotes: ['GBP'],
  },
  selectedDateRange: {
    _tag: 'Just',
    value: {
      aligned: false,
      endDate: '2026-06-09',
      note: { _tag: 'Nothing' },
      startDate: '2026-06-02',
    },
  },
})
