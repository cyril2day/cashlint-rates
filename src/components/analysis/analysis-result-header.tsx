'use client'

import type { DataQualityDto, PairAnalysisViewModelDto } from '@/shared/dto/analysis'

const qualityLabel: Readonly<Record<DataQualityDto['status'], string>> = {
  complete: 'Complete data',
  'limited-data': 'Limited data',
  'no-data': 'No data',
  'partial-data': 'Partial data',
  'same-currency': 'Same currency',
}

export function AnalysisResultHeader({
  result,
}: {
  readonly result: PairAnalysisViewModelDto
}) {
  return (
    <div className="analysis-result__header">
      <p className="section__eyebrow">{qualityLabel[result.dataQuality.status]}</p>
      <h2>{result.pair.label}</h2>
      <p>{result.insight}</p>
    </div>
  )
}
