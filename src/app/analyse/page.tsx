import Link from 'next/link'

export default function AnalysePage() {
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
          This route is reserved for the pair-analysis slice: server-side date ranges, statistics,
          chart view models, calculation explanations, and Bogart context seeds.
        </p>
      </section>
    </main>
  )
}
