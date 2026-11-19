import { fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider, AuthProvider } from 'thefactory-ui/headless/api'
import { AppSettingsProviderConnected } from 'thefactory-ui/web'
import GlobalSettingsShell from './GlobalSettingsShell'

vi.mock('./Sidebar', () => ({ default: () => null }))
vi.mock('@ui/components/settings/BackendConnectionPanel', () => ({ default: () => null }))
vi.mock('thefactory-ui/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('thefactory-ui/web')>()),
  OverseerPanel: () => null,
  OverseerGitPanel: ({ onOpen }: { onOpen: () => void }) => (
    <button type="button" onClick={onOpen}>
      Open Git
    </button>
  ),
  OverseerGitView: ({ onBack }: { onBack: () => void }) => (
    <>
      <h2>Overseer Git</h2>
      <button type="button" onClick={onBack}>
        Back
      </button>
    </>
  ),
}))
vi.mock('thefactory-ui/headless', async (importOriginal) => ({
  ...(await importOriginal<typeof import('thefactory-ui/headless')>()),
  OverseerGitProvider: ({ children }: { children: React.ReactNode }) => children,
}))

function renderSettings(path: string, fromAssistant: boolean): void {
  // MemoryRouter drives the test route stack but does not write HashRouter's index.
  vi.spyOn(window.history, 'state', 'get').mockReturnValue({ idx: Number(fromAssistant) })
  render(
    <AuthProvider storage={{ read: () => null, write: () => undefined }}>
      <ApiProvider apiBaseUrl={null} wsBaseUrl={null} client="desktop">
        <AppSettingsProviderConnected>
          <MemoryRouter initialEntries={[fromAssistant ? '/assistant/conversation' : path]}>
            <Routes>
              <Route
                path="/assistant/conversation"
                element={<Link to={path}>Open Settings from this conversation</Link>}
              />
              <Route path="/assistant" element={<h1>Assistant</h1>} />
              <Route path="/settings" element={<GlobalSettingsShell />} />
            </Routes>
          </MemoryRouter>
        </AppSettingsProviderConnected>
      </ApiProvider>
    </AuthProvider>,
  )
}

describe('Global Settings Back navigation', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows one Back in Overseer Git, then returns through Developer to the originating chat', () => {
    renderSettings('/settings?tab=developer', true)
    fireEvent.click(screen.getByRole('link', { name: 'Open Settings from this conversation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Git' }))
    expect(screen.getByRole('heading', { name: 'Overseer Git', level: 2 })).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Back' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('button', { name: 'Open Git' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('link', { name: 'Open Settings from this conversation' })).toBeVisible()
  })

  it('returns from a direct Overseer Git link to Developer, then falls back to Assistant', () => {
    renderSettings('/settings?tab=developer&subtab=git', false)
    expect(screen.getByRole('heading', { name: 'Overseer Git', level: 2 })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('button', { name: 'Open Git' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Assistant' })).toBeVisible()
  })
})
