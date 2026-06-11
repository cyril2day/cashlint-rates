import type { Metadata } from 'next'
import 'katex/dist/katex.min.css'
import 'pristine-charts/bar-chart.css'
import 'pristine-charts/line-chart.css'
import 'pristine-charts/chart-error.css'
import './styles/main.scss'
import { AppShell } from './app-shell'

export const metadata: Metadata = {
  title: 'Cashlint Rates',
  description: 'Currency conversion, exchange-rate analysis, and comparison using reference data.',
}

const themeScript = `
(() => {
  try {
    const stored = window.localStorage.getItem('cashlint-theme')
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    document.documentElement.dataset.theme = stored || preferred
  } catch {
    document.documentElement.dataset.theme = 'light'
  }
})()
`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
