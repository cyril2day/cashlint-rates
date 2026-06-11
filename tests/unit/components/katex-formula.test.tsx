import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KatexFormula } from '@/components/analysis/katex-formula'

describe('KatexFormula', () => {
  it('renders valid formulas as accessible math', () => {
    const { container } = render(<KatexFormula accessibleText="Latest reference rate." latex="r_n" />)
    const formula = container.querySelector('.cr-katex-formula')

    expect(formula).toHaveAttribute('role', 'math')
    expect(formula).toHaveAttribute('aria-label', 'Latest reference rate.')
  })

  it('falls back to accessible text when KaTeX cannot render the formula', () => {
    const { container } = render(<KatexFormula accessibleText="Broken formula fallback." latex="\\sqrt{" />)
    const fallback = container.querySelector('.cr-katex-formula--fallback')

    expect(fallback).toHaveAttribute('role', 'note')
    expect(screen.getByText('Formula rendering is unavailable. Broken formula fallback.')).toBeInTheDocument()
  })
})
