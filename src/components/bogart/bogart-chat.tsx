'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, SyntheticEvent } from 'react'
import type { BogartResponseViewModelDto, BogartResultContextDto } from '@/shared/dto/bogart'
import { allTrue, anyTrue, fromNullable, isFalse, matchBoolean, matchDtoTag, matchMaybe } from '@/shared/fp'
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
    <p>Ask about the current result, chart, or statistics.</p>
  </div>
)

const messageKey = (message: BogartChatMessage, index: number): string =>
  `${message.tag}-${index.toString()}`

const focusQuestionInput = (input: HTMLTextAreaElement | null): undefined => {
  matchMaybe<HTMLTextAreaElement, undefined>({
    none: () => undefined,
    some: (element) => {
      element.focus()
      return undefined
    },
  })(fromNullable(input))

  return undefined
}

const shouldSubmitFromTextarea = (event: KeyboardEvent<HTMLTextAreaElement>): boolean =>
  allTrue([event.key === 'Enter', isFalse(event.shiftKey)])

const canScrollIntoView = (element: HTMLDivElement): boolean =>
  typeof element.scrollIntoView === 'function'

const scrollElementIntoView = (element: HTMLDivElement): undefined => {
  matchBoolean<undefined>({
    false: () => undefined,
    true: () => {
      element.scrollIntoView({ block: 'end' })
      return undefined
    },
  })(canScrollIntoView(element))

  return undefined
}

export function BogartChat({
  context,
  placeholder,
  suggestions,
}: {
  readonly context: BogartResultContextDto
  readonly placeholder: string
  readonly suggestions: ReadonlyArray<string>
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const questionRef = useRef<HTMLTextAreaElement>(null)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ReadonlyArray<BogartChatMessage>>([])
  const [status, setStatus] = useState<BogartChatStatus>({ tag: 'idle' })
  const loading = status.tag === 'loading'
  const limitReached = status.tag === 'limit-reached'
  const sendDisabled = anyTrue([loading, limitReached, question.trim().length === 0])

  const addMessage = (message: BogartChatMessage): void => {
    setMessages(appendMessage(message))
  }

  useEffect(() => {
    matchMaybe<HTMLDivElement, undefined>({
      none: () => undefined,
      some: scrollElementIntoView,
    })(fromNullable(messagesEndRef.current))

    return undefined
  }, [messages, loading])

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

  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>): undefined => {
    matchBoolean<undefined>({
      false: () => undefined,
      true: () => {
        event.preventDefault()
        sendQuestion(question)
        return undefined
      },
    })(shouldSubmitFromTextarea(event))

    return undefined
  }

  const draftSuggestion = (suggestion: string): void => {
    setQuestion(suggestion)
    focusQuestionInput(questionRef.current)
  }

  return (
    <>
      <div className="bogart-modal__messages" aria-live="polite" tabIndex={0}>
        {matchBoolean<ReactNode>({
          false: () => messages.map((message, index) => <BogartMessage key={messageKey(message, index)} message={message} />),
          true: emptyState,
        })(messages.length === 0)}
        {matchBoolean<ReactNode>({
          false: () => null,
          true: () => <p className="converter-card__note" role="status">Preparing response...</p>,
        })(loading)}
        <div aria-hidden="true" ref={messagesEndRef} />
      </div>
      <form className="bogart-modal__input-row" onSubmit={submitForm}>
        <label className="screen-reader-only" htmlFor="bogart-modal-question">Question</label>
        <textarea
          className="field__control bogart-modal__question"
          disabled={limitReached}
          id="bogart-modal-question"
          maxLength={500}
          onChange={(event) => {
            setQuestion(event.target.value)
          }}
          onKeyDown={submitOnEnter}
          placeholder={placeholder}
          ref={questionRef}
          rows={3}
          value={question}
        />
        <button className="button" disabled={sendDisabled} type="submit">
          Send
        </button>
      </form>
      {matchBoolean<ReactNode>({
        false: () => <BogartSuggestions disabled={loading} onSelect={draftSuggestion} suggestions={suggestions} />,
        true: () => <p className="converter-card__note">10 of 10 questions used today.</p>,
      })(limitReached)}
    </>
  )
}
