import type { BogartRefusalReasonDto } from '@/shared/dto/bogart'

export const refusalMessage = (reason: BogartRefusalReasonDto): string =>
  ({
    'financial-advice':
      'I can explain the exchange-rate data shown here, but I cannot recommend whether to exchange, buy, sell or hold currency.',
    'future-prediction':
      'I cannot predict future exchange rates. I can explain the historical reference-rate data currently shown.',
    'good-rate':
      'I can compare the latest rate with observations in the selected period, but I cannot say whether it is a good rate or recommend an exchange decision.',
    'hidden-instructions':
      'I cannot provide hidden instructions. I can answer questions about the result currently shown.',
    'out-of-scope':
      'I can only answer questions about the result currently shown in Cashlint Rates.',
    'probability-forecast':
      'I cannot provide a probability forecast for future movement. I can explain the observed movement in the selected historical period.',
    'trading-strategy':
      'I cannot provide trading strategies. I can explain the selected exchange-rate data and the calculations shown on this page.',
  })[reason]
