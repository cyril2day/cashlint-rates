'use client'

import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import type {
  AnalysisMetricAvailabilityDto,
  AnalysisMetricValueDto,
  CalculationExplanationDto,
} from '@/shared/dto/analysis'
import type { MaybeDto } from '@/shared/dto/api'
import { matchBoolean, matchDtoTag, matchMaybe, none, some } from '@/shared/fp'
import type { Maybe } from '@/shared/fp'
import { KatexFormula } from './katex-formula'

type FormulaKey = CalculationExplanationDto['formulaKey']
type OpenFormulaKey = Maybe<FormulaKey>
type FormulaCardToggle = () => void

const maybeText = (value: MaybeDto<string>, fallback: string): string =>
  matchDtoTag<MaybeDto<string>, string>({
    Just: (just) => just.value,
    Nothing: () => fallback,
  })(value)

const availabilityText = (availability: AnalysisMetricAvailabilityDto): string =>
  matchDtoTag<AnalysisMetricAvailabilityDto, string>({
    Available: () => 'Available',
    Limited: (limited) => limited.reason,
    NotApplicable: (notApplicable) => notApplicable.reason,
    Unavailable: (unavailable) => unavailable.reason,
  })(availability)

const metricText = (metric: AnalysisMetricValueDto): string =>
  maybeText(metric.displayValue, availabilityText(metric.availability))

const optionalFormulaNote = (
  className: string,
  label: string,
  note: MaybeDto<string>,
): ReactNode =>
  matchDtoTag<MaybeDto<string>, ReactNode>({
    Just: (just) => (
      <p className={className}>
        <span>{label}</span>
        {just.value}
      </p>
    ),
    Nothing: () => null,
  })(note)

const stepItem =
  (formulaKey: CalculationExplanationDto['formulaKey']) =>
  (step: string, index: number): ReactNode => (
    <li key={`${formulaKey}-step-${index.toString()}`}>{step}</li>
  )

const formulaSteps = (explanation: CalculationExplanationDto): ReactNode =>
  matchBoolean<ReactNode>({
    false: () => null,
    true: () => (
      <div className="formula-card__steps">
        <h4>How it works</h4>
        <ol>
          {explanation.steps.map(stepItem(explanation.formulaKey))}
        </ol>
      </div>
    ),
  })(explanation.steps.length > 0)

const selectedFormula =
  (formulaKey: FormulaKey) =>
  (openFormulaKey: OpenFormulaKey): boolean =>
    matchMaybe<FormulaKey, boolean>({
      none: () => false,
      some: (openKey) => openKey === formulaKey,
    })(openFormulaKey)

const nextOpenFormulaKey =
  (formulaKey: FormulaKey) =>
  (openFormulaKey: OpenFormulaKey): OpenFormulaKey =>
    matchBoolean<OpenFormulaKey>({
      false: () => some(formulaKey),
      true: () => none(),
    })(selectedFormula(formulaKey)(openFormulaKey))

const toggleFormulaCard =
  (onToggle: FormulaCardToggle) =>
  (event: MouseEvent<HTMLElement>): undefined => {
    event.preventDefault()
    onToggle()

    return undefined
  }

const workedSolution = (explanation: CalculationExplanationDto): ReactNode =>
  matchDtoTag<MaybeDto<string>, ReactNode>({
    Just: (just) => (
      <div className="formula-card__solution">
        <h4>Worked solution</h4>
        <KatexFormula
          accessibleText={`Worked solution for ${explanation.title}.`}
          latex={just.value}
        />
      </div>
    ),
    Nothing: () => null,
  })(explanation.workedSolutionLatex)

function FormulaCard({
  explanation,
  onToggle,
  open,
}: {
  readonly explanation: CalculationExplanationDto
  readonly onToggle: FormulaCardToggle
  readonly open: boolean
}) {
  return (
    <details className="formula-card cr-formula-card" open={open}>
      <summary className="formula-card__summary" onClick={toggleFormulaCard(onToggle)}>
        <span className="formula-card__title">{explanation.title}</span>
        <span className="formula-card__teaser">{explanation.plainMeaning}</span>
      </summary>
      <div className="formula-card__body">
        <p>{explanation.plainMeaning}</p>
        <KatexFormula accessibleText={explanation.accessibleText} latex={explanation.latexFormula} />
        <p className="formula-card__accessible-text">{explanation.accessibleText}</p>
        {workedSolution(explanation)}
        {formulaSteps(explanation)}
        <dl className="formula-card__result">
          <div>
            <dt>Current result</dt>
            <dd>{metricText(explanation.result)}</dd>
          </div>
          <div>
            <dt>Meaning</dt>
            <dd>{explanation.interpretation}</dd>
          </div>
        </dl>
        {optionalFormulaNote('formula-card__note formula-card__note--warning', 'Unavailable', explanation.unavailableReason)}
      </div>
    </details>
  )
}

export function AnalysisFormulaDisclosures({
  explanations,
}: {
  readonly explanations: ReadonlyArray<CalculationExplanationDto>
}) {
  const [openFormulaKey, setOpenFormulaKey] = useState<OpenFormulaKey>(none())

  return (
    <div className="analysis-result__formulas">
      <h3>Other details</h3>
      <div className="formula-card-grid cr-formula-card-grid">
        {explanations.map((explanation) => (
          <FormulaCard
            explanation={explanation}
            key={explanation.formulaKey}
            onToggle={() => {
              setOpenFormulaKey(nextOpenFormulaKey(explanation.formulaKey))
            }}
            open={selectedFormula(explanation.formulaKey)(openFormulaKey)}
          />
        ))}
      </div>
    </div>
  )
}
