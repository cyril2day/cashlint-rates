'use client'

import { useReducer, useState } from 'react'
import type { Dispatch } from 'react'
import { AnalysisDateRangeFields } from '@/components/analysis/analysis-date-range-fields'
import type { DateRangeChoice } from '@/components/analysis/analysis-form-model'
import type { CompareRequestDto } from '@/shared/dto/comparison'
import { anyTrue, fromNullable, isFalse, matchBoolean, matchMaybe } from '@/shared/fp'
import { matchCompareClientResult, postCompareRequest } from './compare-api-client'
import { ComparisonQuoteFields } from './comparison-quote-fields'
import type { ComparisonAction } from './comparison-state-view'
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

export function CompareCard({
  currencyCodes,
  initialBase,
  initialQuotes,
}: {
  readonly currencyCodes: ReadonlyArray<string>
  readonly initialBase: string
  readonly initialQuotes: ReadonlyArray<string>
}) {
  const [state, dispatch] = useReducer(comparisonStateReducer, initialComparisonState)
  const [base, setBase] = useState(initialBase)
  const [selectedQuotes, setSelectedQuotes] = useState(initialQuotes)
  const [quoteCandidate, setQuoteCandidate] = useState(firstQuote(currencyCodes, initialQuotes))
  const [dateRangeChoice, setDateRangeChoice] = useState<DateRangeChoice>('30D')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const loading = state.tag === 'loading'
  const submitDisabled = anyTrue([loading, selectedQuotes.length === 0])

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
