import type { AttributionDto, CurrencyDto, ISODateTimeStringDto, MaybeDto } from './api'

export type CatalogueSourceDto = 'provider' | 'stale-cache' | 'static-safe-list'

export type CurrencyCatalogueDto = {
  readonly source: CatalogueSourceDto
  readonly retrievedAt: MaybeDto<ISODateTimeStringDto>
  readonly currencies: ReadonlyArray<CurrencyDto>
}

export type CurrenciesResponseDto = {
  readonly catalogue: CurrencyCatalogueDto
  readonly attribution: AttributionDto
}
