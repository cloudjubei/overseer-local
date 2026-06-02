import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectSettingsConnected as useProjectSettings } from 'thefactory-ui/web'

const PROJECT = 'p1'
const KEY = `thefactory.projectSettings.${PROJECT}`

describe('useProjectSettings', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to an empty categories override', () => {
    const { result } = renderHook(() => useProjectSettings(PROJECT))
    expect(result.current.settings.notifications.categories).toEqual({})
  })

  it('persists per-project category overrides under a project-scoped key', () => {
    const { result } = renderHook(() => useProjectSettings(PROJECT))

    act(() => result.current.setNotificationCategory('chat', false))

    expect(result.current.settings.notifications.categories.chat).toBe(false)
    const persisted = JSON.parse(window.localStorage.getItem(KEY) ?? '{}')
    expect(persisted.notifications.categories.chat).toBe(false)
  })

  it('passing undefined clears a stored override', () => {
    const { result } = renderHook(() => useProjectSettings(PROJECT))

    act(() => result.current.setNotificationCategory('chat', false))
    act(() => result.current.setNotificationCategory('chat', undefined))

    expect(result.current.settings.notifications.categories.chat).toBeUndefined()
    const persisted = JSON.parse(window.localStorage.getItem(KEY) ?? '{}')
    expect(persisted.notifications.categories.chat).toBeUndefined()
  })

  it('returns defaults and ignores writes when projectId is undefined', () => {
    const { result } = renderHook(() => useProjectSettings(undefined))

    act(() => result.current.setNotificationCategory('chat', false))

    expect(result.current.settings.notifications.categories).toEqual({})
    expect(window.localStorage.length).toBe(0)
  })

  it('reloads when the project id changes', () => {
    window.localStorage.setItem(
      'thefactory.projectSettings.p2',
      JSON.stringify({ notifications: { categories: { git: false } } }),
    )

    const { result, rerender } = renderHook(({ id }) => useProjectSettings(id), {
      initialProps: { id: PROJECT as string | undefined },
    })

    expect(result.current.settings.notifications.categories.git).toBeUndefined()
    rerender({ id: 'p2' })
    expect(result.current.settings.notifications.categories.git).toBe(false)
  })

})
