'use client'

import type { CalculationExplanationDto } from '@/shared/dto/analysis'
import { KatexFormula } from './katex-formula'

function FormulaDisclosureItem({
  explanation,
}: {
  readonly explanation: CalculationExplanationDto
}) {
  return (
    <details className="formula-disclosure cr-formula-disclosure">
      <summary>{explanation.title}</summary>
      <p>{explanation.plainMeaning}</p>
      <KatexFormula accessibleText={explanation.accessibleText} latex={explanation.latexFormula} />
      <p>{explanation.accessibleText}</p>
    </details>
  )
}

export function AnalysisFormulaDisclosures({
  explanations,
}: {
  readonly explanations: ReadonlyArray<CalculationExplanationDto>
}) {
  return (
    <div className="analysis-result__formulas">
      <h3>Formula details</h3>
      {explanations.map((explanation) => (
        <FormulaDisclosureItem explanation={explanation} key={explanation.formulaKey} />
      ))}
    </div>
  )
}
