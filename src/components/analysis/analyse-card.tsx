'use client'

import { useEffect, useReducer, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import { usePageMemory } from '@/components/page-memory'
import type { AnalyseRequestDto } from '@/shared/dto/analysis'
import { allTrue, isFalse, matchBoolean, matchTag } from '@/shared/fp'
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

const rememberableAnalyseState = (state: AnalyseState): AnalyseState =>
  matchTag<AnalyseState, AnalyseState>({
    failure: (failureState) => failureState,
    initial: () => initialAnalyseState,
    loading: () => initialAnalyseState,
    success: (successState) => successState,
  })(state)

export function AnalyseCard({
  currencyCodes,
  initialBase,
  initialQuote,
  seededFromSearchParams = false,
}: {
  readonly currencyCodes: ReadonlyArray<string>
  readonly initialBase: string
  readonly initialQuote: string
  readonly seededFromSearchParams?: boolean
}) {
  const { analyse, available, setAnalyse } = usePageMemory()
  const useRememberedValues = allTrue([available, isFalse(seededFromSearchParams)])
  const rememberedState = matchBoolean<AnalyseState>({
    false: () => initialAnalyseState,
    true: () => analyse.state,
  })(useRememberedValues)
  const rememberedBase = matchBoolean<string>({
    false: () => initialBase,
    true: () => analyse.base,
  })(useRememberedValues)
  const rememberedQuote = matchBoolean<string>({
    false: () => initialQuote,
    true: () => analyse.quote,
  })(useRememberedValues)
  const rememberedDateRangeChoice = matchBoolean<DateRangeChoice>({
    false: () => '30D',
    true: () => analyse.dateRangeChoice,
  })(useRememberedValues)
  const rememberedStartDate = matchBoolean<string>({
    false: () => '',
    true: () => analyse.startDate,
  })(useRememberedValues)
  const rememberedEndDate = matchBoolean<string>({
    false: () => '',
    true: () => analyse.endDate,
  })(useRememberedValues)
  const [state, dispatch] = useReducer(analyseStateReducer, rememberedState)
  const [base, setBase] = useState(rememberedBase)
  const [quote, setQuote] = useState(rememberedQuote)
  const [dateRangeChoice, setDateRangeChoice] = useState<DateRangeChoice>(rememberedDateRangeChoice)
  const [startDate, setStartDate] = useState(rememberedStartDate)
  const [endDate, setEndDate] = useState(rememberedEndDate)
  const loading = state.tag === 'loading'

  useEffect(() => {
    setAnalyse({
      base,
      dateRangeChoice,
      endDate,
      quote,
      startDate,
      state: rememberableAnalyseState(state),
    })
  }, [base, dateRangeChoice, endDate, quote, setAnalyse, startDate, state])

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
