import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { BogartButton, BogartProvider } from '@/components/bogart'
import { PageMemoryProvider } from '@/components/page-memory'
import { SiteHeader } from './site-header'

type AppShellProps = {
  readonly children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <Suspense>
      <PageMemoryProvider>
        <BogartProvider>
          <div className="app-shell">
            <SiteHeader />
            <div className="app-shell__content">{children}</div>
            <footer className="site-footer">
              Reference rates from Frankfurter API v2 (ECB data). Cashlint Rates is for education and
              reference. It does not provide financial advice or predict future rates.
            </footer>
            <BogartButton />
          </div>
        </BogartProvider>
      </PageMemoryProvider>
    </Suspense>
  )
}
