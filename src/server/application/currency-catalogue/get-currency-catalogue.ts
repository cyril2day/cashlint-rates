import type { CurrenciesResponseDto } from '@/shared/dto/currencies'
import { success, type Result } from '@/shared/fp'
import { staticSafeCurrencyCatalogue } from '@/server/domain/currency/currency'

export type CurrencyCatalogueServiceError = never

const attribution = {
  label: 'Exchange-rate reference data by Frankfurter',
  sourceName: 'Frankfurter API',
  sourceUrl: 'https://frankfurter.dev',
} as const

// getCurrencyCatalogue :: void -> Result<never, CurrenciesResponseDto>
export const getCurrencyCatalogue = (): Result<CurrencyCatalogueServiceError, CurrenciesResponseDto> =>
  success({
    catalogue: {
      source: 'static-safe-list',
      retrievedAt: { _tag: 'Nothing' },
      currencies: staticSafeCurrencyCatalogue.currencies.map((currency) => ({
        code: currency.code,
        name: currency.name,
        symbol: { _tag: 'Just', value: currency.symbol },
      })),
    },
    attribution,
  })
