'use client'

import type { DataQualityDto } from '@/shared/dto/analysis'

export function AnalysisDataQualityPanel({
  dataQuality,
}: {
  readonly dataQuality: DataQualityDto
}) {
  return (
    <div className="analysis-result__quality">
      <h3>Data quality</h3>
      <p>{dataQuality.messages.join(' ')}</p>
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
