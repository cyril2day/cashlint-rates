import Link from 'next/link'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { BogartButton, BogartProvider } from '@/components/bogart'

type AppShellProps = {
  readonly children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <Suspense>
      <BogartProvider>
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
            Reference rates from Frankfurter API v2 (ECB data). Cashlint Rates is for education and
            reference. It does not provide financial advice or predict future rates.
          </footer>
          <BogartButton />
        </div>
      </BogartProvider>
    </Suspense>
  )
}
