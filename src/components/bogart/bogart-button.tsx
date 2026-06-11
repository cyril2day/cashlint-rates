'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { fromNullable, matchBoolean, matchMaybe } from '@/shared/fp'
import type { BogartResultContextDto } from '@/shared/dto/bogart'
import { useBogartContext } from './bogart-context'
import { BogartModal } from './bogart-modal'

type BogartModalState = 'closed' | 'open' | 'closing'
type VisibleBogartModalState = Exclude<BogartModalState, 'closed'>

const nextClosingState = (currentState: BogartModalState): BogartModalState =>
  matchBoolean<BogartModalState>({
    false: () => 'closing',
    true: () => currentState,
  })(currentState === 'closed')

const visibleModalState = (modalState: BogartModalState): VisibleBogartModalState =>
  matchBoolean<VisibleBogartModalState>({
    false: () => 'open',
    true: () => 'closing',
  })(modalState === 'closing')

const focusButton = (button: HTMLButtonElement | null): undefined => {
  matchMaybe<HTMLButtonElement, undefined>({
    none: () => undefined,
    some: (element) => {
      element.focus()
      return undefined
    },
  })(fromNullable(button))

  return undefined
}

export function BogartButton() {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [modalState, setModalState] = useState<BogartModalState>('closed')
  const { available, context, contextLabel, placeholder, suggestions } = useBogartContext()
  const modalVisible = modalState !== 'closed'

  useEffect(() => {
    matchBoolean<undefined>({
      false: () => {
        setModalState('closed')
        return undefined
      },
      true: () => undefined,
    })(available)

    return undefined
  }, [available])

  const openModal = (): void => {
    setModalState('open')
  }

  const requestClose = useCallback((): void => {
    setModalState(nextClosingState)
  }, [])

  const handleExited = useCallback((): void => {
    setModalState('closed')
    window.requestAnimationFrame(() => {
      focusButton(buttonRef.current)
    })
  }, [])

  const renderModalWithContext = (resultContext: BogartResultContextDto): ReactNode =>
    matchBoolean<ReactNode>({
      false: () => null,
      true: () => (
        <BogartModal
          context={resultContext}
          contextLabel={contextLabel}
          onExited={handleExited}
          onRequestClose={requestClose}
          placeholder={placeholder}
          state={visibleModalState(modalState)}
          suggestions={suggestions}
        />
      ),
    })(modalVisible)

  return matchBoolean<ReactNode>({
    false: () => null,
    true: () => (
      <>
        <button
          className="bogart-button"
          aria-expanded={modalVisible}
          aria-haspopup="dialog"
          aria-label="Ask Bogart"
          onClick={openModal}
          ref={buttonRef}
          type="button"
        >
          <span aria-hidden="true" className="bogart-button__icon">?</span>
          <span className="bogart-button__tooltip" role="tooltip">Ask Bogart</span>
        </button>
        {matchMaybe<BogartResultContextDto, ReactNode>({
          none: () => null,
          some: renderModalWithContext,
        })(context)}
      </>
    ),
  })(available)
}
