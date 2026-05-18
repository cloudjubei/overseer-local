import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppSettingsProvider } from '@core/contexts/AppSettingsContext'
import VisualSettings from './VisualSettings'

const STORAGE_KEY = 'thefactory.appSettings'

function renderPanel() {
  return render(
    <AppSettingsProvider>
      <VisualSettings />
    </AppSettingsProvider>,
  )
}

describe('VisualSettings', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders the current theme and persists changes', () => {
    renderPanel()

    const select = screen.getByLabelText(/theme/i) as HTMLSelectElement
    expect(select.value).toBe('system')

    fireEvent.change(select, { target: { value: 'dark' } })

    expect(select.value).toBe('dark')
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.theme).toBe('dark')
  })
})
