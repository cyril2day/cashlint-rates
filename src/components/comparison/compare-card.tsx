'use client'

import { useEffect, useReducer, useState } from 'react'
import type { Dispatch } from 'react'
import { AnalysisDateRangeFields } from '@/components/analysis/analysis-date-range-fields'
import type { DateRangeChoice } from '@/components/analysis/analysis-form-model'
import { usePageMemory } from '@/components/page-memory'
import type { CompareRequestDto } from '@/shared/dto/comparison'
import { allTrue, anyTrue, fromNullable, isFalse, matchBoolean, matchMaybe } from '@/shared/fp'
import { matchCompareClientResult, postCompareRequest } from './compare-api-client'
import { ComparisonQuoteFields } from './comparison-quote-fields'
import type { ComparisonAction, ComparisonState } from './comparison-state-view'
import {
  ComparisonStateView,
  comparisonStateReducer,
  initialComparisonState,
} from './comparison-state-view'
import { toCompareRequest } from './comparison-form-model'

const dispatchClientResult =
  (dispatch: Dispatch<ComparisonAction>) =>
  (result: Awaited<ReturnType<typeof postCompareRequest>>): undefined => {
    matchCompareClientResult<undefined>({
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
  (dispatch: Dispatch<ComparisonAction>) =>
  (input: CompareRequestDto): void => {
    dispatch({ tag: 'submit' })
    void postCompareRequest(input).then(dispatchClientResult(dispatch))
  }

const firstQuote = (currencyCodes: ReadonlyArray<string>, selectedQuotes: ReadonlyArray<string>): string =>
  matchMaybe<string, string>({
    none: () =>
      matchMaybe<string, string>({
        none: () => 'USD',
        some: (code) => code,
      })(fromNullable(currencyCodes[0])),
    some: (code) => code,
  })(fromNullable(currencyCodes.find((code) => isFalse(selectedQuotes.includes(code)))))

const rememberableComparisonState = (state: ComparisonState): ComparisonState =>
  matchBoolean<ComparisonState>({
    false: () => state,
    true: () => initialComparisonState,
  })(state.tag === 'loading')

export function CompareCard({
  currencyCodes,
  initialBase,
  initialQuotes,
  seededFromSearchParams = false,
}: {
  readonly currencyCodes: ReadonlyArray<string>
  readonly initialBase: string
  readonly initialQuotes: ReadonlyArray<string>
  readonly seededFromSearchParams?: boolean
}) {
  const { available, compare, setCompare } = usePageMemory()
  const useRememberedValues = allTrue([available, isFalse(seededFromSearchParams)])
  const rememberedState = matchBoolean({
    false: () => initialComparisonState,
    true: () => compare.state,
  })(useRememberedValues)
  const rememberedBase = matchBoolean({
    false: () => initialBase,
    true: () => compare.base,
  })(useRememberedValues)
  const rememberedSelectedQuotes = matchBoolean({
    false: () => initialQuotes,
    true: () => compare.selectedQuotes,
  })(useRememberedValues)
  const rememberedQuoteCandidate = matchBoolean({
    false: () => firstQuote(currencyCodes, initialQuotes),
    true: () => compare.quoteCandidate,
  })(useRememberedValues)
  const rememberedDateRangeChoice = matchBoolean<DateRangeChoice>({
    false: () => '30D',
    true: () => compare.dateRangeChoice,
  })(useRememberedValues)
  const rememberedStartDate = matchBoolean({
    false: () => '',
    true: () => compare.startDate,
  })(useRememberedValues)
  const rememberedEndDate = matchBoolean({
    false: () => '',
    true: () => compare.endDate,
  })(useRememberedValues)
  const [state, dispatch] = useReducer(comparisonStateReducer, rememberedState)
  const [base, setBase] = useState(rememberedBase)
  const [selectedQuotes, setSelectedQuotes] = useState(rememberedSelectedQuotes)
  const [quoteCandidate, setQuoteCandidate] = useState(rememberedQuoteCandidate)
  const [dateRangeChoice, setDateRangeChoice] = useState<DateRangeChoice>(rememberedDateRangeChoice)
  const [startDate, setStartDate] = useState(rememberedStartDate)
  const [endDate, setEndDate] = useState(rememberedEndDate)
  const loading = state.tag === 'loading'
  const submitDisabled = anyTrue([loading, selectedQuotes.length === 0])

  useEffect(() => {
    setCompare({
      base,
      dateRangeChoice,
      endDate,
      quoteCandidate,
      selectedQuotes,
      startDate,
      state: rememberableComparisonState(state),
    })
  }, [base, dateRangeChoice, endDate, quoteCandidate, selectedQuotes, setCompare, startDate, state])

  return (
    <main className="compare-layout">
      <form
        className="converter-card analysis-card compare-layout__form"
        aria-label="Currency comparison"
        onSubmit={(event) => {
          event.preventDefault()
          submitInput(dispatch)(
            toCompareRequest(base, selectedQuotes, dateRangeChoice, { startDate, endDate }),
          )
        }}
      >
        <ComparisonQuoteFields
          base={base}
          currencyCodes={currencyCodes}
          onBaseChange={setBase}
          onQuoteCandidateChange={setQuoteCandidate}
          onQuotesChange={setSelectedQuotes}
          quoteCandidate={quoteCandidate}
          selectedQuotes={selectedQuotes}
        />
        <AnalysisDateRangeFields
          customRange={{ startDate, endDate }}
          dateRangeChoice={dateRangeChoice}
          setDateRangeChoice={setDateRangeChoice}
          setEndDate={setEndDate}
          setStartDate={setStartDate}
        />
        <button className="button" disabled={submitDisabled} type="submit">
          Compare
        </button>
        {matchBoolean({
          false: () => null,
          true: () => <p className="converter-card__note">Select at least one quote currency to run a comparison.</p>,
        })(selectedQuotes.length === 0)}
      </form>
      <ComparisonStateView state={state} />
    </main>
  )
}
