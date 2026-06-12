import { AnalyseCard } from '@/components/analysis/analyse-card'
import { defaultSupportedCurrencyCodes } from '@/server/domain/currency/currency'
import { anyTrue, chainMaybe, fromNullable, isDefined, withDefault } from '@/shared/fp'

export const dynamic = 'force-dynamic'

type AnalysePageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | undefined>>>
}

const findSupportedCode = (candidate: string) =>
  fromNullable(
    defaultSupportedCurrencyCodes.find((code) => code === candidate.toUpperCase()),
  )

const supportedOrFallback = (candidate: string | undefined, fallback: string): string =>
  withDefault(fallback)(
    chainMaybe(findSupportedCode)(fromNullable(candidate)),
  )

const seededFromSearchParams = (params: Readonly<Record<string, string | undefined>>): boolean =>
  anyTrue([isDefined(params.base), isDefined(params.quote)])

export default async function AnalysePage({ searchParams }: AnalysePageProps) {
  const params = await searchParams
  const initialBase = supportedOrFallback(params.base, 'USD')
  const initialQuote = supportedOrFallback(params.quote, 'GBP')

  return (
    <AnalyseCard
      currencyCodes={defaultSupportedCurrencyCodes}
      initialBase={initialBase}
      initialQuote={initialQuote}
      seededFromSearchParams={seededFromSearchParams(params)}
    />
  )
}
