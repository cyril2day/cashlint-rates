'use client'

import { renderToString } from 'katex'
import { fromThrowable, matchResult, type Result } from '@/shared/fp'

type FormulaRenderError = {
  readonly tag: 'formula-rendering-error'
}

const formulaRenderError: FormulaRenderError = {
  tag: 'formula-rendering-error',
}

const renderFormula = (latex: string): Result<FormulaRenderError, string> =>
  fromThrowable(
    () => renderToString(latex, { throwOnError: true, strict: 'ignore' }),
    () => formulaRenderError,
  )

export function KatexFormula({
  latex,
  accessibleText,
}: {
  readonly latex: string
  readonly accessibleText: string
}) {
  return matchResult<FormulaRenderError, string, React.ReactNode>({
    failure: () => (
      <div className="katex-formula cr-katex-formula katex-formula--fallback cr-katex-formula--fallback" role="note">
        <code>{latex}</code>
        <span>Formula rendering is unavailable. {accessibleText}</span>
      </div>
    ),
    success: (html) => (
      <div
        aria-label={accessibleText}
        className="katex-formula cr-katex-formula"
        dangerouslySetInnerHTML={{ __html: html }}
        role="math"
      />
    ),
  })(renderFormula(latex))
}
