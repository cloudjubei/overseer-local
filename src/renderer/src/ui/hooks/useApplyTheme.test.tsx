import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppSettingsProviderConnected } from 'thefactory-ui/web'
import { useAppSettings } from 'thefactory-ui/headless'
import type { Theme } from '@core/types/settings'
import { useApplyTheme } from './useApplyTheme'

function Probe({ onReady }: { onReady: (setTheme: (t: Theme) => void) => void }) {
  useApplyTheme()
  const { setTheme } = useAppSettings()
  onReady(setTheme)
  return null
}

function renderWithTheme(): { setTheme: (t: Theme) => void } {
  let setTheme!: (t: Theme) => void
  render(
    <AppSettingsProviderConnected>
      <Probe onReady={(s) => (setTheme = s)} />
    </AppSettingsProviderConnected>,
  )
  return { setTheme }
}

type ControllableMql = MediaQueryList & { _setMatches: (m: boolean) => void }

describe('useApplyTheme', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    ;(window.matchMedia('(prefers-color-scheme: dark)') as ControllableMql)._setMatches(false)
  })

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
  })

  it('applies "dark" theme to documentElement', () => {
    const { setTheme } = renderWithTheme()
    act(() => setTheme('dark'))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('switching back to light removes the dark class', () => {
    const { setTheme } = renderWithTheme()

    act(() => setTheme('dark'))
    act(() => setTheme('light'))

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('"system" follows prefers-color-scheme: dark', () => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)') as ControllableMql
    act(() => mql._setMatches(true))

    const { setTheme } = renderWithTheme()
    act(() => setTheme('system'))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('"system" reacts to live OS-level changes', () => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)') as ControllableMql
    const { setTheme } = renderWithTheme()
    act(() => setTheme('system'))

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    act(() => mql._setMatches(true))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applies stored theme on mount', () => {
    window.localStorage.setItem(
      'thefactory.appSettings',
      JSON.stringify({ theme: 'dark', userPreferences: { sidebarCollapsed: false } }),
    )

    renderWithTheme()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
