'use client'

import { useReducer, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import { defaultSupportedCurrencyCodes } from '@/server/domain/currency/currency'
import type { ApiFailureDto } from '@/shared/dto/api'
import type { ConvertRequestDto, ConversionViewModelDto } from '@/shared/dto/conversion'
import { allTrue, matchBoolean, matchTag } from '@/shared/fp'
import { matchConvertClientResult, postConversionRequest } from './convert-api-client'
import { ConverterError } from './converter-error'
import { ConverterResult } from './converter-result'

type ConverterState =
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
      readonly result: ConversionViewModelDto
    }

type ConverterAction =
  | {
      readonly tag: 'submit'
    }
  | {
      readonly tag: 'failure'
      readonly error: ApiFailureDto['error']
    }
  | {
      readonly tag: 'success'
      readonly result: ConversionViewModelDto
    }

const initialState: ConverterState = { tag: 'initial' }

const reducer = (_state: ConverterState, action: ConverterAction): ConverterState =>
  matchTag<ConverterAction, ConverterState>({
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

const clientValidationError: ApiFailureDto['error'] = {
  code: 'INVALID_AMOUNT',
  category: 'validation',
  message: 'Enter an amount greater than 0.',
  recoverable: true,
  fieldErrors: [
    {
      field: 'amount',
      code: 'INVALID_AMOUNT',
      message: 'Enter an amount greater than 0.',
    },
  ],
  details: [],
}

const toRequest = (
  form: HTMLFormElement,
  base: string,
  quote: string,
): ConvertRequestDto => {
  const formData = new FormData(form)
  const amount = formData.get('amount')

  return {
    amount: Number(amount),
    base,
    quote,
  }
}

const isPositiveAmount = (input: ConvertRequestDto): boolean =>
  allTrue([Number.isFinite(input.amount), input.amount > 0])

const dispatchClientResult =
  (dispatch: Dispatch<ConverterAction>) =>
  (result: Awaited<ReturnType<typeof postConversionRequest>>): undefined => {
    matchConvertClientResult<undefined>({
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
  (dispatch: Dispatch<ConverterAction>) =>
  (input: ConvertRequestDto): void => {
    matchBoolean<undefined>({
      false: () => {
        dispatch({ tag: 'failure', error: clientValidationError })
        return undefined
      },
      true: () => {
        dispatch({ tag: 'submit' })
        void postConversionRequest(input).then(dispatchClientResult(dispatch))
        return undefined
      },
    })(isPositiveAmount(input))
  }

const renderState = (state: ConverterState): ReactNode =>
  matchTag<ConverterState, ReactNode>({
    failure: (failureState) => <ConverterError error={failureState.error} />,
    initial: () => <p className="converter-card__note">Enter an amount and choose two currencies.</p>,
    loading: () => <p className="converter-card__note" role="status">Loading latest reference rate.</p>,
    success: (successState) => <ConverterResult result={successState.result} />,
  })(state)

export function ConverterCard() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [base, setBase] = useState('USD')
  const [quote, setQuote] = useState('GBP')
  const loading = state.tag === 'loading'

  return (
    <form
      className="converter-card"
      aria-label="Currency converter"
      onSubmit={(event) => {
        event.preventDefault()
        submitInput(dispatch)(toRequest(event.currentTarget, base, quote))
      }}
    >
      <div className="converter-card__header">
        <h2>Convert currency</h2>
        <p>Convert an amount using the latest available reference rate.</p>
      </div>
      <label className="field" htmlFor="converter-amount">
        <span className="field__label">Amount</span>
        <input
          className="field__control"
          aria-label="Amount"
          id="converter-amount"
          inputMode="decimal"
          name="amount"
          defaultValue="1000"
          aria-describedby="amount-helper"
        />
        <span className="field__helper" id="amount-helper">Enter an amount greater than 0.</span>
      </label>
      <div className="converter-card__grid">
        <label className="field" htmlFor="converter-base">
          <span className="field__label">From</span>
          <select
            className="field__control"
            aria-label="From"
            id="converter-base"
            name="base"
            onChange={(event) => {
              setBase(event.currentTarget.value)
            }}
            value={base}
          >
            {defaultSupportedCurrencyCodes.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="converter-quote">
          <span className="field__label">To</span>
          <select
            className="field__control"
            aria-label="To"
            id="converter-quote"
            name="quote"
            onChange={(event) => {
              setQuote(event.currentTarget.value)
            }}
            value={quote}
          >
            {defaultSupportedCurrencyCodes.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="button button--secondary"
        type="button"
        onClick={() => {
          setBase(quote)
          setQuote(base)
        }}
      >
        Swap
      </button>
      <button className="button" disabled={loading} type="submit">
        Convert
      </button>
      {renderState(state)}
    </form>
  )
}
