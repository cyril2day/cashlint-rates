'use client'

import type { DataQualityDto } from '@/shared/dto/analysis'

export function AnalysisDataQualitySummary({
  dataQuality,
}: {
  readonly dataQuality: DataQualityDto
}) {
  return (
    <div className="analysis-form-quality">
      <p className="analysis-form-quality__message">{dataQuality.messages.join(' ')}</p>
      <dl>
        <div>
          <dt>Usable observations</dt>
          <dd>{dataQuality.usableObservationCount}</dd>
        </div>
        <div>
          <dt>Excluded observations</dt>
          <dd>{dataQuality.excludedObservationCount}</dd>
        </div>
      </dl>
    </div>
  )
}
