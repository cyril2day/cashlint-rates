import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function AboutPage() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <Link className="site-header__brand" href="/">
          Cashlint Rates
        </Link>
      </header>
      <section className="section">
        <p className="section__eyebrow">About</p>
        <h1>Reference-oriented, not advisory</h1>
        <p>
          Cashlint Rates explains exchange-rate movements and calculations for education and
          reference. It does not forecast markets, recommend trades, or provide financial advice.
        </p>
      </section>
    </main>
  )
}
