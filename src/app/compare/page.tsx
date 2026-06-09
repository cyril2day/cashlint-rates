import Link from 'next/link'

export default function ComparePage() {
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
          This route is reserved for indexed comparison charts, ranking rules, explicit data-quality
          states, and formula disclosure.
        </p>
      </section>
    </main>
  )
}
