import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectsProvider } from 'thefactory-ui/headless'
import { ApiProvider, AuthProvider } from 'thefactory-ui/headless/api'
import { AppSettingsProviderConnected } from 'thefactory-ui/web'
import SettingsView, { type SettingsScope } from './SettingsView'

const projectId = 'remembered-project'
const projectSettingsKey = `thefactory.projectSettings.${projectId}`

const appSettingsKey = 'thefactory.appSettings'
const signedOutStorage = { read: () => null, write: () => undefined }

// Storage is a sibling panel with its own providers; exercise the real
// notification controls and their app/project settings persistence here.
vi.mock('thefactory-ui/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('thefactory-ui/web')>()),
  StorageUsageSettings: () => null,
}))

function renderNotifications(scope: SettingsScope): void {
  const path = scope.kind === 'project' ? `/projects/${scope.projectId}/settings` : '/settings'
  render(
    <AuthProvider storage={signedOutStorage}>
      <ApiProvider apiBaseUrl={null} wsBaseUrl={null} client="desktop">
        <AppSettingsProviderConnected>
          <ProjectsProvider>
            <MemoryRouter initialEntries={[`${path}?tab=notifications`]}>
              <SettingsView scope={scope} />
            </MemoryRouter>
          </ProjectsProvider>
        </AppSettingsProviderConnected>
      </ApiProvider>
    </AuthProvider>,
  )
}

describe('SettingsView notification scope', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(
      appSettingsKey,
      JSON.stringify({ userPreferences: { lastActiveProjectId: projectId } }),
    )
  })

  it('writes app preferences without exposing or changing the remembered project override', () => {
    const existing = JSON.stringify({ notifications: { categories: { chat: false } } })
    window.localStorage.setItem(projectSettingsKey, existing)
    renderNotifications({ kind: 'global' })

    expect(screen.getByRole('heading', { name: 'App Notification Preferences' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: /Current Project Notifications/ })).toBeNull()
    expect(
      screen.queryByRole('switch', { name: 'Enable all notifications for this project' }),
    ).toBeNull()

    const sounds = screen.getByRole('switch', { name: 'Enable Notification Sounds' })
    const wasEnabled = sounds.getAttribute('aria-checked') === 'true'
    fireEvent.click(sounds)
    expect(sounds).toHaveAttribute('aria-checked', String(!wasEnabled))
    expect(JSON.parse(window.localStorage.getItem(appSettingsKey) ?? '{}')).toMatchObject({
      notifications: { soundsEnabled: !wasEnabled },
    })
    expect(window.localStorage.getItem(projectSettingsKey)).toBe(existing)
  })

  it('still exposes writable notification overrides in project Settings', () => {
    window.localStorage.setItem(
      projectSettingsKey,
      JSON.stringify({ notifications: { categories: { chat: false } } }),
    )
    renderNotifications({ kind: 'project', projectId })

    expect(screen.getByRole('heading', { name: 'Current Project Notifications' })).toBeVisible()
    const all = screen.getByRole('switch', { name: 'Enable all notifications for this project' })
    expect(all).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(all)
    expect(JSON.parse(window.localStorage.getItem(projectSettingsKey) ?? '{}')).toMatchObject({
      notifications: { categories: { chat: true } },
    })
  })
})
