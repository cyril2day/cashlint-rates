'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { CloseIcon, GitHubIcon, HamburgerIcon, MoonIcon, SunIcon } from '@/components/icons'
import { fromNullable, matchBoolean, matchMaybe } from '@/shared/fp'

type ThemeName = 'dark' | 'light'

const repositoryUrl = 'https://github.com/cyril2day/cashlint-rates'

const themeFromValue = (value: string): ThemeName =>
  matchBoolean<ThemeName>({
    false: () => 'light',
    true: () => 'dark',
  })(value === 'dark')

const nextTheme = (theme: ThemeName): ThemeName =>
  matchBoolean<ThemeName>({
    false: () => 'dark',
    true: () => 'light',
  })(theme === 'dark')

const themeLabel = (theme: ThemeName): string =>
  matchBoolean<string>({
    false: () => 'Use dark theme',
    true: () => 'Use light theme',
  })(theme === 'dark')

const menuLabel = (open: boolean): string =>
  matchBoolean<string>({
    false: () => 'Open navigation menu',
    true: () => 'Close navigation menu',
  })(open)

const navState = (open: boolean): string =>
  matchBoolean<string>({
    false: () => 'closed',
    true: () => 'open',
  })(open)

const renderMenuIcon = (open: boolean): ReactNode =>
  matchBoolean<ReactNode>({
    false: () => <HamburgerIcon className="site-header__icon" />,
    true: () => <CloseIcon className="site-header__icon" />,
  })(open)

const renderThemeIcon = (theme: ThemeName): ReactNode =>
  matchBoolean<ReactNode>({
    false: () => <MoonIcon className="site-header__icon" />,
    true: () => <SunIcon className="site-header__icon" />,
  })(theme === 'dark')

const renderBackLink = (pathname: string, closeMenu: () => void): ReactNode =>
  matchBoolean<ReactNode>({
    false: () => (
      <Link className="site-header__back-link" href="/" onClick={closeMenu}>
        Back to dashboard
      </Link>
    ),
    true: () => null,
  })(pathname === '/')

const currentTheme = (): ThemeName =>
  matchMaybe<string, ThemeName>({
    none: () => 'light',
    some: themeFromValue,
  })(fromNullable(document.documentElement.dataset.theme))

const applyTheme = (theme: ThemeName): undefined => {
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem('cashlint-theme', theme)

  return undefined
}

export function SiteHeader() {
  const pathname = usePathname()
  const navId = useId()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeName>('light')

  useEffect(() => {
    setTheme(currentTheme())

    return undefined
  }, [])

  const closeMenu = (): void => {
    setMobileNavOpen(false)
  }

  const toggleMenu = (): void => {
    setMobileNavOpen((open) => matchBoolean<boolean>({
      false: () => true,
      true: () => false,
    })(open))
  }

  const toggleTheme = (): void => {
    setTheme((previous) => {
      const selectedTheme = nextTheme(previous)
      applyTheme(selectedTheme)

      return selectedTheme
    })
  }

  return (
    <header className="site-header">
      <div className="site-header__main">
        <Link className="site-header__brand" href="/" onClick={closeMenu}>
          Cashlint Rates
        </Link>
        {renderBackLink(pathname, closeMenu)}
      </div>

      <button
        aria-controls={navId}
        aria-expanded={mobileNavOpen}
        aria-label={menuLabel(mobileNavOpen)}
        className="site-header__icon-button site-header__menu-button"
        onClick={toggleMenu}
        type="button"
      >
        {renderMenuIcon(mobileNavOpen)}
      </button>

      <nav
        aria-label="Primary navigation"
        className="site-header__nav"
        data-state={navState(mobileNavOpen)}
        id={navId}
      >
        <Link href="/analyse" onClick={closeMenu}>Analyse</Link>
        <Link href="/compare" onClick={closeMenu}>Compare</Link>
        <div className="site-header__actions">
          <button
            aria-label={themeLabel(theme)}
            className="site-header__icon-button"
            onClick={toggleTheme}
            type="button"
          >
            {renderThemeIcon(theme)}
          </button>
          <a
            aria-label="Open GitHub repository"
            className="site-header__icon-button"
            href={repositoryUrl}
            rel="noreferrer"
            target="_blank"
          >
            <GitHubIcon className="site-header__icon" />
          </a>
        </div>
      </nav>
    </header>
  )
}
