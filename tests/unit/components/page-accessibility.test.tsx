import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppShell } from '@/app/app-shell'
import { AnalyseCard } from '@/components/analysis/analyse-card'
import { CompareCard } from '@/components/comparison/compare-card'
import { ConverterDashboard } from '@/components/conversion/converter-card'
import { fromNullable, matchMaybe } from '@/shared/fp'

const currencyCodes = ['EUR', 'GBP', 'JPY', 'USD']
const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const focusableElements = (container: HTMLElement): ReadonlyArray<HTMLElement> =>
  Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))

const elementName = (element: HTMLElement): string =>
  matchMaybe<string, string>({
    none: () =>
      matchMaybe<string, string>({
        none: () =>
          matchMaybe<string, string>({
            none: () =>
              matchMaybe<string, string>({
                none: () => element.id,
                some: (text) => text,
              })(fromNullable(element.textContent?.trim())),
            some: (name) => name,
          })(fromNullable(element.getAttribute('name'))),
        some: (label) => label,
      })(fromNullable(element.getAttribute('aria-label'))),
    some: (label) => label,
  })(fromNullable(element.getAttribute('aria-label')))

const elementNames = (elements: ReadonlyArray<HTMLElement>): ReadonlyArray<string> =>
  elements.map(elementName)

const focusEachElement = (elements: ReadonlyArray<HTMLElement>): undefined => {
  elements.forEach((element) => {
    element.focus()
    expect(element).toHaveFocus()
  })

  return undefined
}

const expectGlobalShellControls = (): undefined => {
  expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Use dark theme' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open GitHub repository' })).toHaveAttribute(
    'href',
    'https://github.com/cyril2day/cashlint-rates',
  )
  expect(screen.getByRole('contentinfo')).toHaveTextContent('Reference rates from Frankfurter API v2')

  return undefined
}

const expectKeyboardReachablePage = (container: HTMLElement, expectedNames: ReadonlyArray<string>): undefined => {
  const elements = focusableElements(container)

  expect(elementNames(elements)).toEqual(expect.arrayContaining([...expectedNames]))
  focusEachElement(elements)

  return undefined
}

const activateDarkTheme = (): undefined => {
  fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }))
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(screen.getByRole('button', { name: 'Use light theme' })).toBeInTheDocument()

  return undefined
}

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('page accessibility landmarks', () => {
  it('exposes home page landmarks and labelled controls', () => {
    const { container } = render(
      <AppShell>
        <ConverterDashboard />
      </AppShell>,
    )

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expectGlobalShellControls()
    expect(screen.getByRole('main')).toHaveClass('home-layout')
    expect(screen.getByRole('form', { name: 'Currency converter' })).toBeInTheDocument()
    expectKeyboardReachablePage(container, ['Cashlint Rates', 'Analyse', 'Compare', 'Use dark theme', 'Open GitHub repository', 'Swap', 'Convert'])
    activateDarkTheme()
  })

  it('exposes analyse page landmarks and labelled controls', () => {
    const { container } = render(
      <AppShell>
        <AnalyseCard currencyCodes={currencyCodes} initialBase="EUR" initialQuote="JPY" />
      </AppShell>,
    )

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expectGlobalShellControls()
    expect(screen.getByRole('main')).toHaveClass('analyse-layout')
    expect(screen.getByRole('form', { name: 'Pair analysis' })).toBeInTheDocument()
    expectKeyboardReachablePage(container, ['Cashlint Rates', 'Analyse', 'Compare', 'Use dark theme', 'Open GitHub repository', 'Analyse'])
    activateDarkTheme()
  })

  it('exposes compare page landmarks and labelled controls', () => {
    const { container } = render(
      <AppShell>
        <CompareCard currencyCodes={currencyCodes} initialBase="USD" initialQuotes={['EUR', 'GBP']} />
      </AppShell>,
    )

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expectGlobalShellControls()
    expect(screen.getByRole('main')).toHaveClass('compare-layout')
    expect(screen.getByRole('form', { name: 'Currency comparison' })).toBeInTheDocument()
    expectKeyboardReachablePage(container, ['Cashlint Rates', 'Analyse', 'Compare', 'Use dark theme', 'Open GitHub repository', 'Add quote', 'Compare'])
    activateDarkTheme()
  })
})
