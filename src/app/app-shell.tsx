import Link from 'next/link'
import type { ReactNode } from 'react'

type AppShellProps = {
  readonly children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="site-header__brand" href="/">
          Cashlint Rates
        </Link>
        <nav className="site-header__nav" aria-label="Primary navigation">
          <Link href="/analyse">Analyse</Link>
          <Link href="/compare">Compare</Link>
        </nav>
      </header>
      <div className="app-shell__content">{children}</div>
      <footer className="site-footer">
        Data: Frankfurter API v2. Not financial advice. No predictions.
      </footer>
    </div>
  )
}
