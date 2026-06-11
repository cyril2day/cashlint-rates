'use client'

import { useEffect } from 'react'
import type { RefObject } from 'react'
import { allTrue, fromNullable, isFalse, matchBoolean, matchMaybe, none, some } from '@/shared/fp'
import type { Maybe } from '@/shared/fp'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const focusableElements = (container: HTMLElement): ReadonlyArray<HTMLElement> =>
  Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))

type FocusBoundary = {
  readonly firstElement: HTMLElement
  readonly lastElement: HTMLElement
}

const focusBoundary = (elements: ReadonlyArray<HTMLElement>): Maybe<FocusBoundary> =>
  matchMaybe<HTMLElement, Maybe<FocusBoundary>>({
    none,
    some: (firstElement) =>
      matchMaybe<HTMLElement, Maybe<FocusBoundary>>({
        none,
        some: (lastElement) => some({ firstElement, lastElement }),
      })(fromNullable(elements[elements.length - 1])),
  })(fromNullable(elements[0]))

const focusFirstElement = (container: HTMLElement): undefined => {
  const firstElement = matchMaybe<HTMLElement, HTMLElement>({
    none: () => container,
    some: (element) => element,
  })(fromNullable(focusableElements(container)[0]))

  firstElement.focus()

  return undefined
}

const preventAndFocus =
  (event: KeyboardEvent) =>
  (element: HTMLElement): undefined => {
    event.preventDefault()
    element.focus()

    return undefined
  }

const trapBoundary =
  (container: HTMLElement, event: KeyboardEvent) =>
  ({ firstElement, lastElement }: FocusBoundary): undefined => {
    const activeElement = document.activeElement
    const focusOutsideModal = isFalse(container.contains(activeElement))
    const shiftTabFromFirst = allTrue([event.shiftKey, activeElement === firstElement])
    const tabFromLast = allTrue([isFalse(event.shiftKey), activeElement === lastElement])

    const focusFirst = (): undefined => {
      preventAndFocus(event)(firstElement)
      return undefined
    }
    const focusLast = (): undefined => {
      preventAndFocus(event)(lastElement)
      return undefined
    }

    matchBoolean<undefined>({
      false: () => {
        matchBoolean<undefined>({
          false: () => {
            matchBoolean<undefined>({
              false: () => undefined,
              true: focusFirst,
            })(focusOutsideModal)
            return undefined
          },
          true: focusFirst,
        })(tabFromLast)
        return undefined
      },
      true: focusLast,
    })(shiftTabFromFirst)

    return undefined
  }

const trapTabKey =
  (container: HTMLElement) =>
  (event: KeyboardEvent): undefined => {
    const elements = focusableElements(container)

    matchMaybe<FocusBoundary, undefined>({
      none: () => {
        preventAndFocus(event)(container)
        return undefined
      },
      some: trapBoundary(container, event),
    })(focusBoundary(elements))

    return undefined
  }

export function useBogartFocusTrap({
  enabled,
  modalRef,
  onEscape,
}: {
  readonly enabled: boolean
  readonly modalRef: RefObject<HTMLElement | null>
  readonly onEscape: () => void
}) {
  useEffect(() => {
    return matchMaybe<HTMLElement, undefined | (() => void)>({
      none: () => undefined,
      some: (container) =>
        matchBoolean<undefined | (() => void)>({
          false: () => undefined,
          true: () => {
            const handleKeyDown = (event: KeyboardEvent): undefined => {
              matchBoolean<undefined>({
                false: () => {
                  matchBoolean<undefined>({
                    false: () => undefined,
                    true: () => {
                      trapTabKey(container)(event)
                      return undefined
                    },
                  })(event.key === 'Tab')
                  return undefined
                },
                true: () => {
                  event.preventDefault()
                  onEscape()
                  return undefined
                },
              })(event.key === 'Escape')
              return undefined
            }

            focusFirstElement(container)
            document.addEventListener('keydown', handleKeyDown)

            return () => {
              document.removeEventListener('keydown', handleKeyDown)
            }
          },
        })(enabled),
    })(fromNullable(modalRef.current))
  }, [enabled, modalRef, onEscape])
}
