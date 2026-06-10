import Link from 'next/link'
import { CompareCard } from '@/components/comparison/compare-card'
import { defaultSupportedCurrencyCodes } from '@/server/domain/currency/currency'
import { fromNullable, matchBoolean, matchMaybe } from '@/shared/fp'

export const dynamic = 'force-dynamic'

type ComparePageProps = {
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

const supportedQuotes = (
  params: Readonly<Record<string, string | undefined>>,
): ReadonlyArray<string> => {
  const seededQuotes = [params.quote, ...((params.quotes ?? '').split(','))]
    .flatMap((value) =>
      matchMaybe<string, ReadonlyArray<string>>({
        none: () => [],
        some: (candidate) =>
          matchMaybe<string, ReadonlyArray<string>>({
            none: () => [],
            some: (supported) => [supported],
          })(fromNullable(defaultSupportedCurrencyCodes.find((code) => code === candidate.toUpperCase()))),
      })(fromNullable(value)),
    )
  const uniqueQuotes = Array.from(new Set(seededQuotes))

  return matchBoolean<ReadonlyArray<string>>({
    false: () => ['EUR', 'GBP', 'JPY'],
    true: () => uniqueQuotes.slice(0, 10),
  })(uniqueQuotes.length > 0)
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams
  const initialBase = supportedOrFallback('USD')(params.base)
  const initialQuotes = supportedQuotes(params)

  return (
    <main className="app-shell">
      <header className="site-header">
        <Link className="site-header__brand" href="/">
          Cashlint Rates
        </Link>
      </header>
      <section className="section">
        <p className="section__eyebrow">Comparison</p>
        <h1>Compare up to ten quote currencies</h1>
        <p>
          Rebase selected quote currencies to an index of 100, compare their movement, and keep partial
          data visible instead of hiding the awkward bits.
        </p>
        <CompareCard
          currencyCodes={defaultSupportedCurrencyCodes}
          initialBase={initialBase}
          initialQuotes={initialQuotes}
        />
      </section>
    </main>
  )
}
