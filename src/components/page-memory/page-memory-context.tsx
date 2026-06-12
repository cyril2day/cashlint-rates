'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { ApiFailureDto } from '@/shared/dto/api'
import type { PairAnalysisViewModelDto } from '@/shared/dto/analysis'
import type { ComparisonViewModelDto } from '@/shared/dto/comparison'
import type { ConversionViewModelDto } from '@/shared/dto/conversion'
import { fromNullable, matchMaybe } from '@/shared/fp'
import type { DateRangeChoice } from '@/components/analysis/analysis-form-model'

export type RememberedConverterState =
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

export type RememberedAnalyseState =
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
      readonly result: PairAnalysisViewModelDto
    }

export type RememberedComparisonState =
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
      readonly result: ComparisonViewModelDto
    }

export type ConverterMemory = {
  readonly base: string
  readonly quote: string
  readonly state: RememberedConverterState
}

export type AnalyseMemory = {
  readonly base: string
  readonly quote: string
  readonly dateRangeChoice: DateRangeChoice
  readonly startDate: string
  readonly endDate: string
  readonly state: RememberedAnalyseState
}

export type CompareMemory = {
  readonly base: string
  readonly selectedQuotes: ReadonlyArray<string>
  readonly quoteCandidate: string
  readonly dateRangeChoice: DateRangeChoice
  readonly startDate: string
  readonly endDate: string
  readonly state: RememberedComparisonState
}

type PageMemoryContextValue = {
  readonly available: boolean
  readonly converter: ConverterMemory
  readonly setConverter: Dispatch<SetStateAction<ConverterMemory>>
  readonly analyse: AnalyseMemory
  readonly setAnalyse: Dispatch<SetStateAction<AnalyseMemory>>
  readonly compare: CompareMemory
  readonly setCompare: Dispatch<SetStateAction<CompareMemory>>
}

const initialConverterMemory: ConverterMemory = {
  base: 'USD',
  quote: 'GBP',
  state: { tag: 'initial' },
}

const initialAnalyseMemory: AnalyseMemory = {
  base: 'USD',
  dateRangeChoice: '30D',
  endDate: '',
  quote: 'GBP',
  startDate: '',
  state: { tag: 'initial' },
}

const initialCompareMemory: CompareMemory = {
  base: 'USD',
  dateRangeChoice: '30D',
  endDate: '',
  quoteCandidate: 'AUD',
  selectedQuotes: ['EUR', 'GBP', 'JPY'],
  startDate: '',
  state: { tag: 'initial' },
}

const noOpSetConverter: Dispatch<SetStateAction<ConverterMemory>> = () => undefined
const noOpSetAnalyse: Dispatch<SetStateAction<AnalyseMemory>> = () => undefined
const noOpSetCompare: Dispatch<SetStateAction<CompareMemory>> = () => undefined

const fallbackContext: PageMemoryContextValue = {
  analyse: initialAnalyseMemory,
  available: false,
  compare: initialCompareMemory,
  converter: initialConverterMemory,
  setAnalyse: noOpSetAnalyse,
  setCompare: noOpSetCompare,
  setConverter: noOpSetConverter,
}

const PageMemoryContext = createContext<PageMemoryContextValue | null>(null)

export function PageMemoryProvider({ children }: { readonly children: ReactNode }) {
  const [converter, setConverter] = useState<ConverterMemory>(initialConverterMemory)
  const [analyse, setAnalyse] = useState<AnalyseMemory>(initialAnalyseMemory)
  const [compare, setCompare] = useState<CompareMemory>(initialCompareMemory)
  const value = useMemo<PageMemoryContextValue>(
    () => ({
      analyse,
      available: true,
      compare,
      converter,
      setAnalyse,
      setCompare,
      setConverter,
    }),
    [analyse, compare, converter],
  )

  return (
    <PageMemoryContext.Provider value={value}>
      {children}
    </PageMemoryContext.Provider>
  )
}

export const usePageMemory = (): PageMemoryContextValue =>
  matchMaybe<PageMemoryContextValue, PageMemoryContextValue>({
    none: () => fallbackContext,
    some: (context) => context,
  })(fromNullable(useContext(PageMemoryContext)))
