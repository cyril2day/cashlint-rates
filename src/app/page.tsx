import Link from 'next/link'

const supportedPairs = [
  { label: 'USD to GBP', href: '/analyse?base=USD&quote=GBP' },
  { label: 'USD to EUR', href: '/analyse?base=USD&quote=EUR' },
  { label: 'GBP to PHP', href: '/analyse?base=GBP&quote=PHP' },
] as const

export default function HomePage() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <Link className="site-header__brand" href="/">
          Cashlint Rates
        </Link>
        <nav className="site-header__nav" aria-label="Primary navigation">
          <Link href="/analyse">Analyse</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/about">About</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <p className="hero__eyebrow">Educational exchange-rate intelligence</p>
          <h1>Convert first. Analyse with care.</h1>
          <p>
            Cashlint Rates is being built as a calm reference workspace for currency conversion,
            statistical pair analysis, and transparent calculation details.
          </p>
        </div>
        <form className="converter-card" aria-label="Currency converter preview">
          <label className="field">
            <span className="field__label">Amount</span>
            <input className="field__control" inputMode="decimal" defaultValue="1000" />
          </label>
          <div className="converter-card__grid">
            <label className="field">
              <span className="field__label">From</span>
              <select className="field__control" defaultValue="USD">
                <option>USD</option>
                <option>GBP</option>
                <option>EUR</option>
                <option>PHP</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">To</span>
              <select className="field__control" defaultValue="GBP">
                <option>GBP</option>
                <option>USD</option>
                <option>EUR</option>
                <option>PHP</option>
              </select>
            </label>
          </div>
          <button className="button" type="button">
            Convert
          </button>
          <p className="converter-card__note">
            API integration follows after the typed route and service foundation.
          </p>
        </form>
      </section>

      <section className="section" aria-labelledby="spine-status">
        <div className="section__header">
          <p className="section__eyebrow">Milestone 1</p>
          <h2 id="spine-status">Project spine is the first deliverable</h2>
        </div>
        <div className="metric-grid">
          <article className="metric-card">
            <span className="metric-card__label">Default pair</span>
            <strong>USD/GBP</strong>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Data boundary</span>
            <strong>Server-side</strong>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Bogart limit</span>
            <strong>10/day</strong>
          </article>
        </div>
      </section>

      <section className="section" aria-labelledby="quick-start">
        <div className="section__header">
          <p className="section__eyebrow">Next slices</p>
          <h2 id="quick-start">Useful starting routes</h2>
        </div>
        <div className="link-list">
          {supportedPairs.map((pair) => (
            <Link className="link-list__item" href={pair.href} key={pair.href}>
              {pair.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
