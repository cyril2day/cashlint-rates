import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteHeader } from '@/app/site-header'

let currentPathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}))

afterEach(() => {
  currentPathname = '/'
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('SiteHeader', () => {
  it('renders primary navigation, theme, and GitHub controls', () => {
    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: 'Cashlint Rates' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Analyse' })).toHaveAttribute('href', '/analyse')
    expect(screen.getByRole('link', { name: 'Compare' })).toHaveAttribute('href', '/compare')
    expect(screen.getByRole('button', { name: 'Use dark theme' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open GitHub repository' })).toHaveAttribute(
      'href',
      'https://github.com/cyril2day/cashlint-rates',
    )
  })

  it('shows a dashboard back-link away from the home page', () => {
    currentPathname = '/analyse'

    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/')
  })

  it('opens and closes the mobile navigation menu', () => {
    render(<SiteHeader />)

    const menuButton = screen.getByRole('button', { name: 'Open navigation menu' })
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' })

    expect(nav).toHaveAttribute('data-state', 'closed')

    fireEvent.click(menuButton)

    expect(nav).toHaveAttribute('data-state', 'open')
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation menu' }))

    expect(nav).toHaveAttribute('data-state', 'closed')
  })

  it('persists theme changes on the html element and localStorage', () => {
    render(<SiteHeader />)

    fireEvent.click(screen.getByRole('button', { name: 'Use dark theme' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('cashlint-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Use light theme' })).toBeInTheDocument()
  })
})
