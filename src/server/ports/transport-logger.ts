import type { ISODateTimeStringDto, MaybeDto } from '@/shared/dto/api'

export type TransportOperation = 'currency-catalogue' | 'latest-rate' | 'historical-rates'

export type TransportStatus = 'success' | 'failure'

export type TransportLogEvent = {
  readonly timestamp: ISODateTimeStringDto
  readonly route: 'provider'
  readonly operation: TransportOperation
  readonly adapter: 'frankfurter'
  readonly method: 'GET'
  readonly status: TransportStatus
  readonly durationMs: MaybeDto<number>
  readonly cachePolicyKey: MaybeDto<string>
  readonly errorCode: MaybeDto<string>
  readonly upstreamStatus: MaybeDto<number>
  readonly redactionApplied: true
}

export type TransportLogger = {
  readonly log: (event: TransportLogEvent) => void
}

export const noopTransportLogger: TransportLogger = {
  log: () => undefined,
}
