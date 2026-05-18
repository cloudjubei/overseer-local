import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_PROJECT_SETTINGS,
  type NotificationPrefs,
  type ProjectSettings,
} from '../types/settings'

const STORAGE_PREFIX = 'thefactory.projectSettings.'

function key(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`
}

function read(projectId: string | undefined): ProjectSettings {
  if (!projectId) return DEFAULT_PROJECT_SETTINGS
  try {
    const raw = window.localStorage.getItem(key(projectId))
    if (!raw) return DEFAULT_PROJECT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ProjectSettings>
    return {
      notifications: {
        categories: { ...(parsed.notifications?.categories ?? {}) },
      },
    }
  } catch {
    return DEFAULT_PROJECT_SETTINGS
  }
}

function write(projectId: string, next: ProjectSettings): void {
  try {
    window.localStorage.setItem(key(projectId), JSON.stringify(next))
  } catch {
    /* localStorage unavailable or quota exceeded */
  }
}

export type ProjectSettingsApi = {
  settings: ProjectSettings
  setNotificationCategory: (
    category: keyof NotificationPrefs['categories'],
    enabled: boolean | undefined,
  ) => void
}

/**
 * Per-project UI preferences. Stored in `localStorage` (keyed by `projectId`)
 * because they are per-user / per-device concerns. When `projectId` is
 * undefined we surface defaults and `setNotificationCategory` is a no-op.
 *
 * Pass `undefined` to clear a category override (i.e. fall back to the global
 * `AppSettings.notifications` toggle).
 */
export function useProjectSettings(projectId: string | undefined): ProjectSettingsApi {
  const [settings, setSettings] = useState<ProjectSettings>(() => read(projectId))

  // Re-read whenever the active project changes.
  useEffect(() => {
    setSettings(read(projectId))
  }, [projectId])

  // Cross-tab updates for the same project.
  useEffect(() => {
    if (!projectId) return
    const k = key(projectId)
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== k) return
      setSettings(read(projectId))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [projectId])

  const setNotificationCategory = useCallback<ProjectSettingsApi['setNotificationCategory']>(
    (category, enabled) => {
      if (!projectId) return
      setSettings((current) => {
        const categories = { ...current.notifications.categories }
        if (enabled === undefined) delete categories[category]
        else categories[category] = enabled
        const next: ProjectSettings = { notifications: { categories } }
        write(projectId, next)
        return next
      })
    },
    [projectId],
  )

  return { settings, setNotificationCategory }
}
