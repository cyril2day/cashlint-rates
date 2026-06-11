'use client'

import type { ReactNode } from 'react'
import type { ApiFailureDto } from '@/shared/dto/api'
import type { PairAnalysisViewModelDto } from '@/shared/dto/analysis'
import { matchTag } from '@/shared/fp'
import { AnalysisError } from './analysis-error'
import { AnalysisResult } from './analysis-result'

export type AnalyseState =
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
      readonly result: PairAnalysisViewModelDto
    }

export type AnalyseAction =
  | {
      readonly tag: 'submit'
    }
  | {
      readonly tag: 'failure'
      readonly error: ApiFailureDto['error']
    }
  | {
      readonly tag: 'success'
      readonly result: PairAnalysisViewModelDto
    }

export const initialAnalyseState: AnalyseState = { tag: 'initial' }

export const analyseStateReducer = (
  _state: AnalyseState,
  action: AnalyseAction,
): AnalyseState =>
  matchTag<AnalyseAction, AnalyseState>({
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

function AnalysisStatusPanel({
  children,
}: {
  readonly children: ReactNode
}) {
  return (
    <section className="analyse-layout__status" aria-live="polite">
      {children}
    </section>
  )
}

export function AnalysisStateView({ state }: { readonly state: AnalyseState }) {
  return matchTag<AnalyseState, ReactNode>({
    failure: (failureState) => (
      <AnalysisStatusPanel>
        <AnalysisError error={failureState.error} />
      </AnalysisStatusPanel>
    ),
    initial: () => (
      <AnalysisStatusPanel>
        <p className="converter-card__note">Choose a pair and date range to analyse.</p>
      </AnalysisStatusPanel>
    ),
    loading: () => (
      <AnalysisStatusPanel>
        <p className="converter-card__note" role="status">Loading historical reference rates.</p>
      </AnalysisStatusPanel>
    ),
    success: (successState) => <AnalysisResult result={successState.result} />,
  })(state)
}
