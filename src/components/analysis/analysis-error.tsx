'use client'

import type { ApiFailureDto } from '@/shared/dto/api'

export function AnalysisError({ error }: { readonly error: ApiFailureDto['error'] }) {
  return (
    <div className="converter-card__message converter-card__message--error" role="alert">
      <strong>{error.code.replaceAll('_', ' ').toLowerCase()}</strong>
      <p>{error.message}</p>
    </div>
  )
}
