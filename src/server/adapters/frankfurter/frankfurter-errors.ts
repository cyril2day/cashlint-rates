import type { ProviderError } from '@/server/ports/rate-provider'

export const frankfurterNetworkError: ProviderError = {
  tag: 'network',
  message: 'Frankfurter could not be reached.',
}

export const frankfurterUnavailableError = (status: number): ProviderError => ({
  tag: 'unavailable',
  status,
  message: 'Frankfurter did not return a usable rate response.',
})

export const frankfurterRateLimitError: ProviderError = {
  tag: 'rate-limit',
  message: 'Frankfurter rate limit was reached.',
}

export const frankfurterInvalidPayloadError = (message: string): ProviderError => ({
  tag: 'invalid-payload',
  message,
})
