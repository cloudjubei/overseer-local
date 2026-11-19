import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IngestionProvider, ProjectsProvider } from 'thefactory-ui/headless'
import { ApiProvider, AuthProvider } from 'thefactory-ui/headless/api'
import { AppSettingsProviderConnected } from 'thefactory-ui/web'
import SettingsView, { type SettingsScope } from './SettingsView'

const projectId = 'remembered-project'
const signedOutStorage = { read: () => null, write: () => undefined }

function renderDatabase(scope: SettingsScope): void {
  const path = scope.kind === 'project' ? `/projects/${scope.projectId}/settings` : '/settings'
  render(
    <AuthProvider storage={signedOutStorage}>
      <ApiProvider apiBaseUrl={null} wsBaseUrl={null} client="desktop">
        <AppSettingsProviderConnected>
          <ProjectsProvider>
            <IngestionProvider>
              <MemoryRouter initialEntries={[`${path}?tab=database`]}>
                <SettingsView scope={scope} />
              </MemoryRouter>
            </IngestionProvider>
          </ProjectsProvider>
        </AppSettingsProviderConnected>
      </ApiProvider>
    </AuthProvider>,
  )
}

describe('SettingsView database scope', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(
      'thefactory.appSettings',
      JSON.stringify({ userPreferences: { lastActiveProjectId: projectId } }),
    )
    vi.stubGlobal('fetch', async () => Response.json({ configured: false }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('keeps health and reindex-all without offering actions for the remembered project', () => {
    renderDatabase({ kind: 'global' })

    expect(screen.getByRole('heading', { name: 'Database connection' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Reindex all/ })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Reindex this project' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data location' })).not.toBeInTheDocument()
  })

  it('keeps project operations in project Settings', () => {
    renderDatabase({ kind: 'project', projectId })

    expect(screen.getByRole('button', { name: 'Reindex this project' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Data location' })).toBeVisible()
  })
})
