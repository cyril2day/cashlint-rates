'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { BogartResultContextDto } from '@/shared/dto/bogart'
import { allTrue, fromNullable, matchBoolean, matchMaybe, none, some } from '@/shared/fp'
import type { Maybe } from '@/shared/fp'
import { BogartChat } from './bogart-chat'
import { useBogartFocusTrap } from './bogart-focus-trap'
import { BogartBulldogIcon, CloseIcon } from './bogart-icons'

type BogartModalState = 'open' | 'closing'

type BogartModalProps = {
  readonly context: BogartResultContextDto
  readonly contextLabel: string
  readonly placeholder: string
  readonly state: BogartModalState
  readonly suggestions: ReadonlyArray<string>
  readonly onExited: () => void
  readonly onRequestClose: () => void
}

const closeAnimationDurationMs = 150

const prefersReducedMotion = (): boolean =>
  matchMaybe<typeof window.matchMedia, boolean>({
    none: () => false,
    some: (matchMedia) => matchMedia.call(window, '(prefers-reduced-motion: reduce)').matches,
  })(fromNullable(window.matchMedia))

const closeDelay = (): number =>
  matchBoolean<number>({
    false: () => closeAnimationDurationMs,
    true: () => 0,
  })(prefersReducedMotion())

const withBodyScrollLocked = (): (() => void) => {
  const previousOverflow = document.body.style.overflow
  const previousPaddingRight = document.body.style.paddingRight
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

  document.body.style.overflow = 'hidden'
  matchBoolean<undefined>({
    false: () => undefined,
    true: () => {
      document.body.style.paddingRight = `${scrollbarWidth.toString()}px`
      return undefined
    },
  })(allTrue([scrollbarWidth > 0, document.documentElement.clientWidth > 0]))

  return () => {
    document.body.style.overflow = previousOverflow
    document.body.style.paddingRight = previousPaddingRight
  }
}

type BackgroundSnapshot = {
  readonly appShell: HTMLElement
  readonly hadInert: boolean
  readonly previousAriaHidden: Maybe<string>
}

const backgroundSnapshot = (): Maybe<BackgroundSnapshot> =>
  matchMaybe<HTMLElement, Maybe<BackgroundSnapshot>>({
    none,
    some: (appShell) =>
      some({
        appShell,
        hadInert: appShell.hasAttribute('inert'),
        previousAriaHidden: fromNullable(appShell.getAttribute('aria-hidden')),
      }),
  })(fromNullable(document.querySelector<HTMLElement>('.app-shell')))

const makeBackgroundInert = ({ appShell }: BackgroundSnapshot): undefined => {
  appShell.setAttribute('inert', '')
  appShell.setAttribute('aria-hidden', 'true')

  return undefined
}

const restoreInertAttribute = ({ appShell, hadInert }: BackgroundSnapshot): undefined => {
  matchBoolean<undefined>({
    false: () => {
      appShell.removeAttribute('inert')
      return undefined
    },
    true: () => {
      appShell.setAttribute('inert', '')
      return undefined
    },
  })(hadInert)

  return undefined
}

const restoreAriaHidden = ({ appShell, previousAriaHidden }: BackgroundSnapshot): undefined => {
  matchMaybe<string, undefined>({
    none: () => {
      appShell.removeAttribute('aria-hidden')
      return undefined
    },
    some: (value) => {
      appShell.setAttribute('aria-hidden', value)
      return undefined
    },
  })(previousAriaHidden)

  return undefined
}
const restoreBackground = (snapshot: BackgroundSnapshot): undefined => {
  restoreInertAttribute(snapshot)
  restoreAriaHidden(snapshot)

  return undefined
}

const withBackgroundInert = (): (() => void) => {
  const snapshot = backgroundSnapshot()
  matchMaybe<BackgroundSnapshot, undefined>({
    none: () => undefined,
    some: makeBackgroundInert,
  })(snapshot)

  return () => {
    matchMaybe<BackgroundSnapshot, undefined>({
      none: () => undefined,
      some: restoreBackground,
    })(snapshot)
  }
}

export function BogartModal({
  context,
  contextLabel,
  placeholder,
  state,
  suggestions,
  onExited,
  onRequestClose,
}: BogartModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const contextId = useId()

  useBogartFocusTrap({
    enabled: state === 'open',
    modalRef,
    onEscape: onRequestClose,
  })

  useEffect(() => {
    const restoreScroll = withBodyScrollLocked()
    const restoreBackground = withBackgroundInert()

    return () => {
      restoreBackground()
      restoreScroll()
    }
  }, [])

  useEffect(() => {
    return matchBoolean<undefined | (() => void)>({
      false: () => undefined,
      true: () => {
        const timeoutId = window.setTimeout(onExited, closeDelay())

        return () => {
          window.clearTimeout(timeoutId)
        }
      },
    })(state === 'closing')
  }, [onExited, state])

  return createPortal(
    <div
      className="bogart-modal"
      data-state={state}
      onClick={(event) => {
        matchBoolean<undefined>({
          false: () => undefined,
          true: () => {
            onRequestClose()
            return undefined
          },
        })(event.target === event.currentTarget)
      }}
    >
      <div
        className="bogart-modal__panel"
        aria-describedby={contextId}
        aria-labelledby={titleId}
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="bogart-modal__header">
          <div className="bogart-modal__identity">
            <span aria-hidden="true" className="bogart-modal__portrait">
              <BogartBulldogIcon className="bogart-modal__portrait-image" flipped />
            </span>
            <h2 id={titleId}>Bogart</h2>
          </div>
          <button
            aria-label="Close"
            className="button button--secondary bogart-modal__close"
            onClick={onRequestClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>
        <p className="bogart-modal__context" id={contextId}>Context: {contextLabel}</p>
        <BogartChat context={context} placeholder={placeholder} suggestions={suggestions} />
      </div>
    </div>,
    document.body,
  )
}
