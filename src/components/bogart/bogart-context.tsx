'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { MaybeDto } from '@/shared/dto/api'
import type { BogartResultContextDto } from '@/shared/dto/bogart'
import { formatDateReadable } from '@/shared/date'
import { fromNullable, matchBoolean, matchDtoTag, matchMaybe, none, some } from '@/shared/fp'
import type { Maybe } from '@/shared/fp'

export type BogartPageContext = {
  readonly page: 'home' | 'analyse' | 'compare'
  readonly base: string
  readonly quotes: ReadonlyArray<string>
  readonly dateRange: string
  readonly hasResult: boolean
}

type BogartContextValue = {
  readonly available: boolean
  readonly context: Maybe<BogartResultContextDto>
  readonly contextLabel: string
  readonly pageContext: BogartPageContext
  readonly placeholder: string
  readonly suggestions: ReadonlyArray<string>
  readonly clearResultContext: () => void
  readonly setResultContext: (context: BogartResultContextDto) => void
}

type SearchParamsReader = {
  readonly get: (key: string) => string | null
}

const fallbackPageContext: BogartPageContext = {
  base: 'USD',
  dateRange: '',
  hasResult: false,
  page: 'home',
  quotes: ['GBP'],
}

const noOp = (): undefined =>
  undefined

const fallbackContext: BogartContextValue = {
  available: false,
  clearResultContext: noOp,
  context: none(),
  contextLabel: 'Convert · USD/GBP',
  pageContext: fallbackPageContext,
  placeholder: 'Ask about this conversion...',
  setResultContext: noOp,
  suggestions: [
    'Explain this result',
    'What affects this rate?',
    'How was this calculated?',
  ],
}

const BogartContext = createContext<BogartContextValue | null>(null)

const routePages: Readonly<Record<string, BogartPageContext['page']>> = {
  '/analyse': 'analyse',
  '/compare': 'compare',
}

const routePage = (pathname: string): BogartPageContext['page'] =>
  matchMaybe<BogartPageContext['page'], BogartPageContext['page']>({
    none: () => 'home',
    some: (page) => page,
  })(fromNullable(routePages[pathname]))

const fallbackQuoteForPage: Readonly<Record<BogartPageContext['page'], ReadonlyArray<string>>> = {
  analyse: ['GBP'],
  compare: ['EUR', 'GBP', 'JPY'],
  home: ['GBP'],
}

const fallbackDateRangeForPage: Readonly<Record<BogartPageContext['page'], string>> = {
  analyse: 'Last 30 days',
  compare: 'Last 30 days',
  home: '',
}

const firstSearchValue = (params: SearchParamsReader, key: string): Maybe<string> =>
  fromNullable(params.get(key))

const quotesSearchValue = (params: SearchParamsReader): Maybe<string> =>
  fromNullable(params.get('quotes'))

const selectedBase = (params: SearchParamsReader): string =>
  matchMaybe<string, string>({
    none: () => 'USD',
    some: (base) => base.toUpperCase(),
  })(firstSearchValue(params, 'base'))

const selectedQuotes = (
  page: BogartPageContext['page'],
  params: SearchParamsReader,
): ReadonlyArray<string> => {
  const quote = matchMaybe<string, ReadonlyArray<string>>({
    none: () => [],
    some: (value) => [value],
  })(firstSearchValue(params, 'quote'))
  const quotes = matchMaybe<string, ReadonlyArray<string>>({
    none: () => [],
    some: (value) => value.split(','),
  })(quotesSearchValue(params))
  const selected = [...quote, ...quotes]
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0)
  const unique = Array.from(new Set(selected))

  const maybeUnique = matchBoolean<Maybe<ReadonlyArray<string>>>({
    false: none,
    true: () => some(unique),
  })(unique.length > 0)

  return matchMaybe<ReadonlyArray<string>, ReadonlyArray<string>>({
    none: () => fallbackQuoteForPage[page],
    some: (values) => values,
  })(maybeUnique)
}

const emptySearchParams = (): SearchParamsReader =>
  new URLSearchParams()

const usableSearchParams = (params: SearchParamsReader | null): SearchParamsReader =>
  matchMaybe<SearchParamsReader, SearchParamsReader>({
    none: emptySearchParams,
    some: (value) => value,
  })(fromNullable(params))

const routeContext = (pathname: string, params: SearchParamsReader): BogartPageContext => {
  const page = routePage(pathname)

  return {
    base: selectedBase(params),
    dateRange: fallbackDateRangeForPage[page],
    hasResult: false,
    page,
    quotes: selectedQuotes(page, params),
  }
}

const pageForMode: Readonly<Record<BogartResultContextDto['mode'], BogartPageContext['page']>> = {
  comparison: 'compare',
  conversion: 'home',
  'pair-analysis': 'analyse',
}

const dateRangeText = (
  dateRange: MaybeDto<{
    readonly startDate: string
    readonly endDate: string
  }>,
): string =>
  matchDtoTag<typeof dateRange, string>({
    Just: (value) => `${formatDateReadable(value.value.startDate)} to ${formatDateReadable(value.value.endDate)}`,
    Nothing: () => '',
  })(dateRange)

const resultPageContext = (context: BogartResultContextDto): BogartPageContext => ({
  base: context.selectedCurrencies.base,
  dateRange: dateRangeText(context.selectedDateRange),
  hasResult: true,
  page: pageForMode[context.mode],
  quotes: context.selectedCurrencies.quotes,
})

const pageLabel: Readonly<Record<BogartPageContext['page'], string>> = {
  analyse: 'Analyse',
  compare: 'Compare',
  home: 'Convert',
}

const pairLabel = (context: BogartPageContext): string =>
  `${context.base}/${context.quotes.join(', ')}`

const displayParts = (context: BogartPageContext): ReadonlyArray<string> =>
  [pageLabel[context.page], pairLabel(context), context.dateRange].filter((part) => part.length > 0)

const contextLabel = (context: BogartPageContext): string =>
  displayParts(context).join(' · ')

const placeholderForPage: Readonly<Record<BogartPageContext['page'], string>> = {
  analyse: 'Ask about this chart, formula, or result...',
  compare: 'Ask about this comparison or ranking...',
  home: 'Ask about this conversion...',
}

const suggestionsForPage: Readonly<Record<BogartPageContext['page'], ReadonlyArray<string>>> = {
  analyse: [
    'Explain this chart',
    'What does typical movement mean?',
    'Summarise these statistics',
    'Why is this metric unavailable?',
  ],
  compare: [
    'Explain this comparison',
    'Why was this quote excluded?',
    'What does relative variability mean?',
    'Summarise the ranking',
  ],
  home: [
    'Explain this result',
    'What affects this rate?',
    'How was this calculated?',
  ],
}

export function BogartProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [context, setContext] = useState<Maybe<BogartResultContextDto>>(none())
  const routedContext = useMemo(
    () => routeContext(pathname, usableSearchParams(searchParams)),
    [pathname, searchParams],
  )
  const pageContext = matchMaybe<BogartResultContextDto, BogartPageContext>({
    none: () => routedContext,
    some: resultPageContext,
  })(context)
  const clearResultContext = useCallback((): void => {
    setContext(none())
  }, [])
  const setResultContext = useCallback((resultContext: BogartResultContextDto): void => {
    setContext(some(resultContext))
  }, [])
  const value = useMemo<BogartContextValue>(
    () => ({
      available: context.tag === 'some',
      clearResultContext,
      context,
      contextLabel: contextLabel(pageContext),
      pageContext,
      placeholder: placeholderForPage[pageContext.page],
      setResultContext,
      suggestions: suggestionsForPage[pageContext.page],
    }),
    [clearResultContext, context, pageContext, setResultContext],
  )

  return (
    <BogartContext.Provider value={value}>
      {children}
    </BogartContext.Provider>
  )
}

export const useBogartContext = (): BogartContextValue =>
  matchMaybe<BogartContextValue, BogartContextValue>({
    none: () => fallbackContext,
    some: (context) => context,
  })(fromNullable(useContext(BogartContext)))

export function useBogartResultAvailability(context: BogartResultContextDto) {
  const { clearResultContext, setResultContext } = useBogartContext()

  useEffect(() => {
    setResultContext(context)

    return () => {
      clearResultContext()
    }
  }, [clearResultContext, context, setResultContext])
}
