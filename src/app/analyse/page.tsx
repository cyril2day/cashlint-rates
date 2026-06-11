import { AnalyseCard } from '@/components/analysis/analyse-card'
import { defaultSupportedCurrencyCodes } from '@/server/domain/currency/currency'
import { fromNullable, matchMaybe } from '@/shared/fp'

export const dynamic = 'force-dynamic'

type AnalysePageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | undefined>>>
}

const supportedOrFallback =
  (fallback: string) =>
  (candidate: string | undefined): string =>
    matchMaybe<string, string>({
      none: () => fallback,
      some: (value) =>
        matchMaybe<string, string>({
          none: () => fallback,
          some: (supported) => supported,
        })(fromNullable(defaultSupportedCurrencyCodes.find((code) => code === value.toUpperCase()))),
    })(fromNullable(candidate))

export default async function AnalysePage({ searchParams }: AnalysePageProps) {
  const params = await searchParams
  const initialBase = supportedOrFallback('USD')(params.base)
  const initialQuote = supportedOrFallback('GBP')(params.quote)

  return (
    <AnalyseCard
      currencyCodes={defaultSupportedCurrencyCodes}
      initialBase={initialBase}
      initialQuote={initialQuote}
    />
  )
}
