import Link from 'next/link'
import { AnalyseCard } from '@/components/analysis/analyse-card'
import { defaultSupportedCurrencyCodes } from '@/server/domain/currency/currency'
import { fromNullable, matchMaybe } from '@/shared/fp'

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
    <main className="app-shell">
      <header className="site-header">
        <Link className="site-header__brand" href="/">
          Cashlint Rates
        </Link>
      </header>
      <section className="section">
        <p className="section__eyebrow">Pair analysis</p>
        <h1>Analyse an exchange-rate pair</h1>
        <p>
          Inspect historical reference-rate movement, data quality, and the formulas behind each metric.
        </p>
        <AnalyseCard
          currencyCodes={defaultSupportedCurrencyCodes}
          initialBase={initialBase}
          initialQuote={initialQuote}
        />
      </section>
    </main>
  )
}
