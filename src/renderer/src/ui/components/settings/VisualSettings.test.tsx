import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppSettingsProvider, useAppSettings } from '@core/contexts/AppSettingsContext'
import { VisualSettings } from 'thefactory-ui/web'

const STORAGE_KEY = 'thefactory.appSettings'

function ThemeSetter() {
  const { setTheme } = useAppSettings()
  return (
    <button data-testid="set-dark" onClick={() => setTheme('dark')}>
      set dark
    </button>
  )
}

function renderPanel() {
  return render(
    <AppSettingsProvider>
      <VisualSettings />
      <ThemeSetter />
    </AppSettingsProvider>,
  )
}

describe('VisualSettings', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders the current theme and persists changes through the context', () => {
    renderPanel()

    const trigger = screen.getByLabelText('Theme') as HTMLButtonElement
    expect(trigger).toHaveTextContent('System')

    act(() => {
      screen.getByTestId('set-dark').click()
    })

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.theme).toBe('dark')
    expect(trigger).toHaveTextContent('Dark')
  })
})
