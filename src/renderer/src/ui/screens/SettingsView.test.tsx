import { fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppSettingsProviderConnected } from 'thefactory-ui/web'
import SettingsView from './SettingsView'

vi.mock('@ui/components/settings/LLMSettings', () => ({
  default: () => <h2>LLM configurations</h2>,
}))

function SettingsWithHistory(): React.JSX.Element {
  const { search } = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output aria-label="Settings query">{search}</output>
      <button onClick={() => navigate(-1)}>Back</button>
      <SettingsView scope={{ kind: 'global' }} />
    </>
  )
}

function renderSettings(path: string): void {
  render(
    <AppSettingsProviderConnected>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/assistant/conversation"
            element={<Link to="/settings?tab=llms">Open settings from conversation</Link>}
          />
          <Route path="/settings" element={<SettingsWithHistory />} />
          <Route
            path="/projects/:projectId/settings"
            element={<SettingsView scope={{ kind: 'project', projectId: 'example' }} />}
          />
        </Routes>
      </MemoryRouter>
    </AppSettingsProviderConnected>,
  )
}

describe('SettingsView', () => {
  it.each(['/settings', '/settings?tab=llms', '/settings?tab=unknown', '/settings?tab=project'])(
    'selects LLMs without a project at %s',
    (path) => {
      renderSettings(path)
      expect(screen.getByRole('heading', { name: 'LLM configurations' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'LLMs' })).toHaveAttribute('aria-current', 'page')
      expect(screen.queryByRole('button', { name: 'Project' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Group' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Processes' })).not.toBeInTheDocument()
    },
  )

  it('replaces the query when changing category so Back returns to the conversation', () => {
    renderSettings('/assistant/conversation')
    fireEvent.click(screen.getByRole('link', { name: 'Open settings from conversation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Visual' }))
    expect(screen.getByLabelText('Settings query')).toHaveTextContent('?tab=visual')
    expect(screen.getByRole('button', { name: 'Visual' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('link', { name: 'Open settings from conversation' })).toBeVisible()
  })

  it('uses the same LLM panel in project settings and keeps project categories there', () => {
    renderSettings('/projects/example/settings?tab=llms')
    expect(screen.getByRole('heading', { name: 'LLM configurations' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Project' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Processes' })).toBeVisible()
  })
})
