'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { BogartResultContextDto } from '@/shared/dto/bogart'
import { fromNullable, matchBoolean, matchMaybe, none, some } from '@/shared/fp'
import type { Maybe } from '@/shared/fp'
import { BogartChat } from './bogart-chat'
import { useBogartFocusTrap } from './bogart-focus-trap'

type BogartModalState = 'open' | 'closing'

type BogartModalProps = {
  readonly context: BogartResultContextDto
  readonly state: BogartModalState
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

  document.body.style.overflow = 'hidden'

  return () => {
    document.body.style.overflow = previousOverflow
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
  state,
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
          <h2 id={titleId}>Bogart</h2>
          <button className="button button--secondary" onClick={onRequestClose} type="button">
            Close
          </button>
        </header>
        <p className="bogart-modal__context" id={contextId}>Context: Current page</p>
        <BogartChat context={context} />
      </div>
    </div>,
    document.body,
  )
}
