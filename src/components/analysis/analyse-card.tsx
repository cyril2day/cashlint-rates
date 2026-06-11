'use client'

import { useReducer, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { AnalyseRequestDto } from '@/shared/dto/analysis'
import { matchTag } from '@/shared/fp'
import { AnalysisDataQualitySummary } from './analysis-data-quality-panel'
import type { AnalyseAction, AnalyseState } from './analysis-state-view'
import { AnalysisCurrencyFields } from './analysis-currency-fields'
import { AnalysisDateRangeFields } from './analysis-date-range-fields'
import type { DateRangeChoice } from './analysis-form-model'
import { toAnalyseRequest } from './analysis-form-model'
import {
  AnalysisStateView,
  analyseStateReducer,
  initialAnalyseState,
} from './analysis-state-view'
import { matchAnalyseClientResult, postAnalyseRequest } from './analyse-api-client'

const dispatchClientResult =
  (dispatch: Dispatch<AnalyseAction>) =>
  (result: Awaited<ReturnType<typeof postAnalyseRequest>>): undefined => {
    matchAnalyseClientResult<undefined>({
      failure: (error) => {
        dispatch({ tag: 'failure', error })
        return undefined
      },
      success: (value) => {
        dispatch({ tag: 'success', result: value })
        return undefined
      },
    })(result)

    return undefined
  }

const submitInput =
  (dispatch: Dispatch<AnalyseAction>) =>
  (input: AnalyseRequestDto): void => {
    dispatch({ tag: 'submit' })
    void postAnalyseRequest(input).then(dispatchClientResult(dispatch))
  }

const formQualitySummary = (state: AnalyseState): ReactNode =>
  matchTag<AnalyseState, ReactNode>({
    failure: () => null,
    initial: () => null,
    loading: () => null,
    success: (successState) => <AnalysisDataQualitySummary dataQuality={successState.result.dataQuality} />,
  })(state)

export function AnalyseCard({
  currencyCodes,
  initialBase,
  initialQuote,
}: {
  readonly currencyCodes: ReadonlyArray<string>
  readonly initialBase: string
  readonly initialQuote: string
}) {
  const [state, dispatch] = useReducer(analyseStateReducer, initialAnalyseState)
  const [base, setBase] = useState(initialBase)
  const [quote, setQuote] = useState(initialQuote)
  const [dateRangeChoice, setDateRangeChoice] = useState<DateRangeChoice>('30D')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const loading = state.tag === 'loading'

  return (
    <main className="analyse-layout">
      <form
        className="converter-card analysis-card analyse-layout__form"
        aria-label="Pair analysis"
        onSubmit={(event) => {
          event.preventDefault()
          submitInput(dispatch)(
            toAnalyseRequest(base, quote, dateRangeChoice, { startDate, endDate }),
          )
        }}
      >
        <AnalysisCurrencyFields
          base={base}
          currencyCodes={currencyCodes}
          onBaseChange={setBase}
          onQuoteChange={setQuote}
          quote={quote}
        />
        <AnalysisDateRangeFields
          customRange={{ startDate, endDate }}
          dateRangeChoice={dateRangeChoice}
          setDateRangeChoice={setDateRangeChoice}
          setEndDate={setEndDate}
          setStartDate={setStartDate}
        />
        <button className="button" disabled={loading} type="submit">
          Analyse
        </button>
        {formQualitySummary(state)}
      </form>
      <AnalysisStateView state={state} />
    </main>
  )
}
