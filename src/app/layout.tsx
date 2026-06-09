import type { Metadata } from 'next'
import 'katex/dist/katex.min.css'
import 'pristine-charts/line-chart.css'
import 'pristine-charts/chart-error.css'
import './styles/main.scss'

export const metadata: Metadata = {
  title: 'Cashlint Rates',
  description: 'Educational currency conversion and exchange-rate analysis.',
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
        {children}
      </body>
    </html>
  )
}
