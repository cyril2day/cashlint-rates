'use client'

import { useState } from 'react'
import type { KeyboardEvent, ReactNode, SyntheticEvent } from 'react'
import type { BogartResponseViewModelDto, BogartResultContextDto } from '@/shared/dto/bogart'
import { anyTrue, fromNullable, matchBoolean, matchDtoTag, matchMaybe } from '@/shared/fp'
import { matchBogartClientResult, postBogartRequest } from './bogart-api-client'
import { BogartMessage } from './bogart-message'
import type { BogartChatMessage } from './bogart-message'
import { BogartSuggestions } from './bogart-suggestions'

type BogartChatStatus =
  | {
      readonly tag: 'idle'
    }
  | {
      readonly tag: 'loading'
    }
  | {
      readonly tag: 'limit-reached'
    }

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

const isLimitReached = (response: BogartResponseViewModelDto): boolean =>
  matchDtoTag<BogartResponseViewModelDto, boolean>({
    BogartAnswer: () => false,
    BogartDailyLimitReached: () => true,
    BogartRefusal: () => false,
    BogartUnavailable: () => false,
  })(response)

const appendMessage =
  (message: BogartChatMessage) =>
  (messages: ReadonlyArray<BogartChatMessage>): ReadonlyArray<BogartChatMessage> => [
    ...messages,
    message,
  ]

const emptyState = (): ReactNode => (
  <div className="bogart-chat__empty">
    <p>Ask Bogart about the current result, chart, or statistics.</p>
  </div>
)

export function BogartChat({
  context,
  placeholder,
  suggestions,
}: {
  readonly context: BogartResultContextDto
  readonly placeholder: string
  readonly suggestions: ReadonlyArray<string>
}) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ReadonlyArray<BogartChatMessage>>([])
  const [status, setStatus] = useState<BogartChatStatus>({ tag: 'idle' })
  const loading = status.tag === 'loading'
  const limitReached = status.tag === 'limit-reached'
  const sendDisabled = anyTrue([loading, limitReached, question.trim().length === 0])

  const addMessage = (message: BogartChatMessage): void => {
    setMessages(appendMessage(message))
  }

  const receiveResponse = (response: BogartResponseViewModelDto): undefined => {
    addMessage({ tag: 'response', response })
    setStatus(matchBoolean<BogartChatStatus>({
      false: () => ({ tag: 'idle' }),
      true: () => ({ tag: 'limit-reached' }),
    })(isLimitReached(response)))

    return undefined
  }

  const sendQuestion = (submittedQuestion: string): void => {
    const trimmedQuestion = submittedQuestion.trim()

    matchBoolean<undefined>({
      false: () => {
        addMessage({ tag: 'user', question: trimmedQuestion })
        setQuestion('')
        setStatus({ tag: 'loading' })
        void postBogartRequest({
          anonymousUserKey: anonymousUserKey(),
          context,
          question: trimmedQuestion,
        }).then((result) => {
          matchBogartClientResult<undefined>({
            failure: (error) => {
              addMessage({ tag: 'failure', error })
              setStatus({ tag: 'idle' })
              return undefined
            },
            success: receiveResponse,
          })(result)
        })
        return undefined
      },
      true: () => undefined,
    })(anyTrue([loading, limitReached, trimmedQuestion.length === 0]))
  }

  const submitForm = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    sendQuestion(question)
  }

  const submitOnEnter = (event: KeyboardEvent<HTMLInputElement>): undefined => {
    matchBoolean<undefined>({
      false: () => undefined,
      true: () => {
        event.preventDefault()
        sendQuestion(question)
        return undefined
      },
    })(event.key === 'Enter')

    return undefined
  }

  return (
    <>
      <div className="bogart-modal__messages" aria-live="polite" tabIndex={0}>
        {matchBoolean<ReactNode>({
          false: () => messages.map((message) => <BogartMessage key={`${message.tag}-${messages.indexOf(message).toString()}`} message={message} />),
          true: emptyState,
        })(messages.length === 0)}
        {matchBoolean<ReactNode>({
          false: () => null,
          true: () => <p className="converter-card__note" role="status">Bogart is thinking...</p>,
        })(loading)}
      </div>
      <form className="bogart-modal__input-row" onSubmit={submitForm}>
        <label className="screen-reader-only" htmlFor="bogart-modal-question">Question</label>
        <input
          className="field__control"
          disabled={limitReached}
          id="bogart-modal-question"
          maxLength={500}
          onChange={(event) => {
            setQuestion(event.target.value)
          }}
          onKeyDown={submitOnEnter}
          placeholder={placeholder}
          type="text"
          value={question}
        />
        <button className="button" disabled={sendDisabled} type="submit">
          Send
        </button>
      </form>
      {matchBoolean<ReactNode>({
        false: () => <BogartSuggestions disabled={loading} onSelect={sendQuestion} suggestions={suggestions} />,
        true: () => <p className="converter-card__note">10 of 10 questions used today.</p>,
      })(limitReached)}
    </>
  )
}
