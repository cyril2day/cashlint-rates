import Link from 'next/link'
import { CompareCard } from '@/components/comparison/compare-card'
import { defaultSupportedCurrencyCodes } from '@/server/domain/currency/currency'
import { chainMaybe, fromNullable, isDefined, matchBoolean, maybeToArray, withDefault } from '@/shared/fp'

export const dynamic = 'force-dynamic'

type ComparePageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | undefined>>>
}

const findSupportedCode = (candidate: string) =>
  fromNullable(
    defaultSupportedCurrencyCodes.find((code) => code === candidate.toUpperCase()),
  )

const supportedOrFallback =
  (fallback: string) =>
  (candidate: string | undefined): string =>
    withDefault(fallback)(
      chainMaybe(findSupportedCode)(fromNullable(candidate)),
    )

const toSupportedQuote = (value: string): ReadonlyArray<string> =>
  maybeToArray(chainMaybe(findSupportedCode)(fromNullable(value)))

const supportedQuotes = (
  params: Readonly<Record<string, string | undefined>>,
): ReadonlyArray<string> => {
  const rawQuotes = withDefault('')(fromNullable(params.quotes))
  const candidates = [params.quote, ...rawQuotes.split(',')]
  const seededQuotes = candidates.filter(isDefined).flatMap(toSupportedQuote)
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
