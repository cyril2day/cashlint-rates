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

export type ConverterState =
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

export type ConverterAction =
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

export const initialConverterState: ConverterState = { tag: 'initial' }

export const converterReducer = (_state: ConverterState, action: ConverterAction): ConverterState =>
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

export const toConverterRequest = (
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

export const submitConverterInput =
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

export const ConverterStateView = ({ state }: { readonly state: ConverterState }) =>
  matchTag<ConverterState, ReactNode>({
    failure: (failureState) => <ConverterError error={failureState.error} />,
    initial: () => <p className="converter-card__note">Enter an amount and choose two currencies.</p>,
    loading: () => <p className="converter-card__note" role="status">Loading latest reference rate.</p>,
    success: (successState) => <ConverterResult result={successState.result} />,
  })(state)

type ConverterCardProps = {
  readonly base: string
  readonly quote: string
  readonly loading: boolean
  readonly onBaseChange: (base: string) => void
  readonly onQuoteChange: (quote: string) => void
  readonly onSubmit: (form: HTMLFormElement) => void
}

export function ConverterCard({
  base,
  quote,
  loading,
  onBaseChange,
  onQuoteChange,
  onSubmit,
}: ConverterCardProps) {
  return (
    <form
      className="converter-card"
      aria-label="Currency converter"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(event.currentTarget)
      }}
    >
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
              onBaseChange(event.currentTarget.value)
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
              onQuoteChange(event.currentTarget.value)
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
          onBaseChange(quote)
          onQuoteChange(base)
        }}
      >
        Swap
      </button>
      <button className="button" disabled={loading} type="submit">
        Convert
      </button>
    </form>
  )
}

export function ConverterDashboard() {
  const [state, dispatch] = useReducer(converterReducer, initialConverterState)
  const [base, setBase] = useState('USD')
  const [quote, setQuote] = useState('GBP')
  const loading = state.tag === 'loading'

  return (
    <main className="home-layout">
      <ConverterCard
        base={base}
        loading={loading}
        onBaseChange={setBase}
        onQuoteChange={setQuote}
        onSubmit={(form) => {
          submitConverterInput(dispatch)(toConverterRequest(form, base, quote))
        }}
        quote={quote}
      />
      <div className="home-layout__result">
        <ConverterStateView state={state} />
      </div>
    </main>
  )
}
