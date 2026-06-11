'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { BogartResultContextDto } from '@/shared/dto/bogart'
import { fromNullable, matchMaybe, none, some } from '@/shared/fp'
import type { Maybe } from '@/shared/fp'

type BogartAvailabilityContextValue = {
  readonly available: boolean
  readonly context: Maybe<BogartResultContextDto>
  readonly clearResultContext: () => void
  readonly setResultContext: (context: BogartResultContextDto) => void
}

const noOp = (): undefined =>
  undefined

const fallbackAvailability: BogartAvailabilityContextValue = {
  available: false,
  clearResultContext: noOp,
  context: none(),
  setResultContext: noOp,
}

const BogartAvailabilityContext = createContext<BogartAvailabilityContextValue | null>(null)

export function BogartAvailabilityProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const [context, setContext] = useState<Maybe<BogartResultContextDto>>(none())
  const clearResultContext = useCallback((): void => {
    setContext(none())
  }, [])
  const setResultContext = useCallback((resultContext: BogartResultContextDto): void => {
    setContext(some(resultContext))
  }, [])
  const value = useMemo<BogartAvailabilityContextValue>(
    () => ({
      available: context.tag === 'some',
      clearResultContext,
      context,
      setResultContext,
    }),
    [clearResultContext, context, setResultContext],
  )

  return (
    <BogartAvailabilityContext.Provider value={value}>
      {children}
    </BogartAvailabilityContext.Provider>
  )
}

export const useBogartAvailability = (): BogartAvailabilityContextValue =>
  matchMaybe<BogartAvailabilityContextValue, BogartAvailabilityContextValue>({
    none: () => fallbackAvailability,
    some: (context) => context,
  })(fromNullable(useContext(BogartAvailabilityContext)))

export function useBogartResultAvailability(context: BogartResultContextDto) {
  const { clearResultContext, setResultContext } = useBogartAvailability()

  useEffect(() => {
    setResultContext(context)

    return () => {
      clearResultContext()
    }
  }, [clearResultContext, context, setResultContext])
}
