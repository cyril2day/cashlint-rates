import Link from 'next/link'
import { ConverterCard } from '@/components/conversion/converter-card'

export const dynamic = 'force-dynamic'

const supportedPairs: ReadonlyArray<{ readonly label: string, readonly href: string }> = [
  { label: 'USD to GBP', href: '/analyse?base=USD&quote=GBP' },
  { label: 'USD to EUR', href: '/analyse?base=USD&quote=EUR' },
  { label: 'GBP to PHP', href: '/analyse?base=GBP&quote=PHP' },
]

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
        <ConverterCard />
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
