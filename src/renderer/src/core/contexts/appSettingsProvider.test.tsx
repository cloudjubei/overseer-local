import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppSettingsProviderConnected } from 'thefactory-ui/web'
import { useAppSettings } from 'thefactory-ui/headless'

const STORAGE_KEY = 'thefactory.appSettings'

function wrapper({ children }: { children: React.ReactNode }) {
  return <AppSettingsProviderConnected>{children}</AppSettingsProviderConnected>
}

describe('AppSettingsProviderConnected', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults theme to "system" and sidebarCollapsed to false', () => {
    const { result } = renderHook(() => useAppSettings(), { wrapper })
    expect(result.current.settings.theme).toBe('system')
    expect(result.current.settings.userPreferences.sidebarCollapsed).toBe(false)
  })

  it('setTheme updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useAppSettings(), { wrapper })

    act(() => result.current.setTheme('dark'))

    expect(result.current.settings.theme).toBe('dark')
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.theme).toBe('dark')
  })

  it('setUserPreferences merges into userPreferences and persists', () => {
    const { result } = renderHook(() => useAppSettings(), { wrapper })

    act(() => result.current.setUserPreferences({ sidebarCollapsed: true }))

    expect(result.current.settings.userPreferences.sidebarCollapsed).toBe(true)
    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.userPreferences.sidebarCollapsed).toBe(true)
  })

  it('cross-tab storage updates re-read settings', async () => {
    const { result } = renderHook(() => useAppSettings(), { wrapper })

    act(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme: 'dark', userPreferences: { sidebarCollapsed: false } }),
      )
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    })

    await waitFor(() => expect(result.current.settings.theme).toBe('dark'))
  })

  it('falls back to defaults when storage is unparseable', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json')
    const { result } = renderHook(() => useAppSettings(), { wrapper })
    expect(result.current.settings.theme).toBe('system')
  })

  it('defaults stories list to "all" filter + "index_asc" sort', () => {
    const { result } = renderHook(() => useAppSettings(), { wrapper })
    expect(result.current.settings.userPreferences.storiesListViewStatusFilter).toBe('all')
    expect(result.current.settings.userPreferences.storiesListViewSorting).toBe('index_asc')
  })

  it('persists stories sort + filter changes and rehydrates them on next mount', async () => {
    const first = renderHook(() => useAppSettings(), { wrapper })

    act(() => {
      first.result.current.setUserPreferences({
        storiesListViewSorting: 'index_desc',
        storiesListViewStatusFilter: 'not-done',
      })
    })

    // Persistence runs in a useEffect — wait one tick for the storage write
    // to commit before tearing down the first hook.
    await waitFor(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      expect(raw).toBeTruthy()
      const persisted = JSON.parse(raw ?? '{}')
      expect(persisted.userPreferences.storiesListViewSorting).toBe('index_desc')
      expect(persisted.userPreferences.storiesListViewStatusFilter).toBe('not-done')
    })

    first.unmount()

    // Fresh mount = next-session simulation. Should rehydrate from storage.
    const second = renderHook(() => useAppSettings(), { wrapper })
    expect(second.result.current.settings.userPreferences.storiesListViewSorting).toBe('index_desc')
    expect(second.result.current.settings.userPreferences.storiesListViewStatusFilter).toBe(
      'not-done',
    )
  })
})
