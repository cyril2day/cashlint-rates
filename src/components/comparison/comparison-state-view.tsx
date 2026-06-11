'use client'

import type { ReactNode } from 'react'
import type { ApiFailureDto } from '@/shared/dto/api'
import type { ComparisonViewModelDto } from '@/shared/dto/comparison'
import { matchTag } from '@/shared/fp'
import { AnalysisError } from '@/components/analysis/analysis-error'
import { ComparisonResult } from './comparison-result'

export type ComparisonState =
  | {
      readonly tag: 'initial'
    }
  | {
      readonly tag: 'loading'
    }
  | {
      readonly tag: 'failure'
      readonly error: ApiFailureDto['error']
    }
  | {
      readonly tag: 'success'
      readonly result: ComparisonViewModelDto
    }

export type ComparisonAction =
  | {
      readonly tag: 'submit'
    }
  | {
      readonly tag: 'failure'
      readonly error: ApiFailureDto['error']
    }
  | {
      readonly tag: 'success'
      readonly result: ComparisonViewModelDto
    }

export const initialComparisonState: ComparisonState = { tag: 'initial' }

export const comparisonStateReducer = (
  _state: ComparisonState,
  action: ComparisonAction,
): ComparisonState =>
  matchTag<ComparisonAction, ComparisonState>({
    failure: (failureAction) => ({
      tag: 'failure',
      error: failureAction.error,
    }),
    submit: () => ({
      tag: 'loading',
    }),
    success: (successAction) => ({
      tag: 'success',
      result: successAction.result,
    }),
  })(action)

function ComparisonStatusPanel({
  children,
}: {
  readonly children: ReactNode
}) {
  return (
    <section className="compare-layout__status" aria-live="polite">
      {children}
    </section>
  )
}

export function ComparisonStateView({ state }: { readonly state: ComparisonState }) {
  return matchTag<ComparisonState, ReactNode>({
    failure: (failureState) => (
      <ComparisonStatusPanel>
        <AnalysisError error={failureState.error} />
      </ComparisonStatusPanel>
    ),
    initial: () => (
      <ComparisonStatusPanel>
        <p className="converter-card__note">Choose a base, quote currencies, and date range to compare.</p>
      </ComparisonStatusPanel>
    ),
    loading: () => (
      <ComparisonStatusPanel>
        <p className="converter-card__note" role="status">Loading comparison reference rates.</p>
      </ComparisonStatusPanel>
    ),
    success: (successState) => <ComparisonResult result={successState.result} />,
  })(state)
}
