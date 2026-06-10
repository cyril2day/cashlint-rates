'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ApiFailureDto } from '@/shared/dto/api'
import type { BogartResponseViewModelDto, BogartResultContextDto } from '@/shared/dto/bogart'
import { anyTrue, fromNullable, matchBoolean, matchDtoTag, matchMaybe, matchTag } from '@/shared/fp'
import { matchBogartClientResult, postBogartRequest } from './bogart-api-client'

type BogartState =
  | {
      readonly tag: 'idle'
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
      readonly result: BogartResponseViewModelDto
    }

const promptSuggestions = [
  'Explain the latest rate',
  'Summarise the chart',
  'Explain period movement',
  'Why is this metric unavailable?',
] as const

const storageKey = 'cashlint-bogart-anonymous-key'

const anonymousUserKey = (): string => {
  const stored = window.localStorage.getItem(storageKey)

  return matchMaybe<string, string>({
    none: () => {
      const created = crypto.randomUUID()

      window.localStorage.setItem(storageKey, created)

      return created
    },
    some: (value) => value,
  })(fromNullable(stored))
}

const remainingText = (remaining: number): string =>
  matchBoolean<string>({
    false: () => `${remaining.toString()} Bogart questions left today.`,
    true: () => `${remaining.toString()} Bogart question left today.`,
  })(remaining === 1)

function BogartOutcome({ result }: { readonly result: BogartResponseViewModelDto }) {
  return matchDtoTag<BogartResponseViewModelDto, ReactNode>({
    BogartAnswer: (answer) => (
      <article className="bogart-panel__message bogart-panel__message--answer">
        <p>{answer.answer}</p>
        <span>{remainingText(answer.remainingQuestions)}</span>
      </article>
    ),
    BogartDailyLimitReached: (limit) => (
      <article className="bogart-panel__message bogart-panel__message--limit">
        <p>Daily question limit reached. Try again after {limit.resetAt}.</p>
      </article>
    ),
    BogartRefusal: (refusal) => (
      <article className="bogart-panel__message bogart-panel__message--refusal">
        <p>{refusal.message}</p>
        <span>{remainingText(refusal.remainingQuestions)}</span>
      </article>
    ),
    BogartUnavailable: (unavailable) => (
      <article className="bogart-panel__message bogart-panel__message--unavailable">
        <p>{unavailable.message}</p>
      </article>
    ),
  })(result)
}

function BogartStateView({ state }: { readonly state: BogartState }) {
  return matchTag<BogartState, ReactNode>({
    failure: (failure) => (
      <article className="bogart-panel__message bogart-panel__message--unavailable">
        <p>{failure.error.message}</p>
      </article>
    ),
    idle: () => null,
    loading: () => <p className="converter-card__note" role="status">Preparing an answer from the current result.</p>,
    success: (success) => <BogartOutcome result={success.result} />,
  })(state)
}

export function BogartPanel({ context }: { readonly context: BogartResultContextDto }) {
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<BogartState>({ tag: 'idle' })
  const loading = state.tag === 'loading'

  const askQuestion = (submittedQuestion: string): void => {
    setState({ tag: 'loading' })
    void postBogartRequest({
      anonymousUserKey: anonymousUserKey(),
      context,
      question: submittedQuestion,
    }).then((result) => {
      matchBogartClientResult<undefined>({
        failure: (error) => {
          setState({ tag: 'failure', error })
          return undefined
        },
        success: (value) => {
          setState({ tag: 'success', result: value })
          return undefined
        },
      })(result)
    })
  }

  const submitQuestion = (): void => {
    askQuestion(question)
  }

  return (
    <details className="bogart-panel">
      <summary>Ask Bogart</summary>
      <div className="bogart-panel__body">
        <div>
          <h3>Questions about this result</h3>
          <p>Ask about the result currently shown, including the chart, statistics and calculation details.</p>
        </div>
        <div className="bogart-panel__chips" aria-label="Bogart prompt suggestions">
          {promptSuggestions.map((suggestion) => (
            <button
              className="button button--secondary"
              disabled={loading}
              key={suggestion}
              onClick={() => {
                setQuestion(suggestion)
                askQuestion(suggestion)
              }}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="bogart-panel__form">
          <label htmlFor="bogart-question">Question</label>
          <div className="bogart-panel__input-row">
            <input
              id="bogart-question"
              maxLength={500}
              onChange={(event) => {
                setQuestion(event.target.value)
              }}
              placeholder="Ask about the result shown on this page"
              type="text"
              value={question}
            />
            <button
              className="button"
              disabled={anyTrue([loading, question.trim().length === 0])}
              onClick={submitQuestion}
              type="button"
            >
              Ask
            </button>
          </div>
        </div>
        <BogartStateView state={state} />
      </div>
    </details>
  )
}
