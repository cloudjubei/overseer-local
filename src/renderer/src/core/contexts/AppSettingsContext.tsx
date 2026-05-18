import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type NotificationPrefs,
  type Theme,
  type UserPreferences,
} from '../types/settings'

const STORAGE_KEY = 'thefactory.appSettings'

export type AppSettingsContextValue = {
  settings: AppSettings
  setTheme: (theme: Theme) => void
  setUserPreferences: (patch: Partial<UserPreferences>) => void
  setNotifications: (patch: Partial<NotificationPrefs>) => void
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null)

function readFromStorage(): AppSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_APP_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      userPreferences: {
        ...DEFAULT_APP_SETTINGS.userPreferences,
        ...(parsed.userPreferences ?? {}),
        shortcuts: {
          ...DEFAULT_APP_SETTINGS.userPreferences.shortcuts,
          ...(parsed.userPreferences?.shortcuts ?? {}),
        },
      },
      notifications: {
        ...DEFAULT_APP_SETTINGS.notifications,
        ...(parsed.notifications ?? {}),
        categories: {
          ...DEFAULT_APP_SETTINGS.notifications.categories,
          ...(parsed.notifications?.categories ?? {}),
        },
        badgesEnabled: {
          ...DEFAULT_APP_SETTINGS.notifications.badgesEnabled,
          ...(parsed.notifications?.badgesEnabled ?? {}),
        },
        badgeColors: {
          ...DEFAULT_APP_SETTINGS.notifications.badgeColors,
          ...(parsed.notifications?.badgeColors ?? {}),
        },
        gitBadgeSubToggles: {
          ...DEFAULT_APP_SETTINGS.notifications.gitBadgeSubToggles,
          ...(parsed.notifications?.gitBadgeSubToggles ?? {}),
        },
      },
    }
  } catch {
    return DEFAULT_APP_SETTINGS
  }
}

function writeToStorage(next: AppSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* localStorage unavailable or quota exceeded */
  }
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(readFromStorage)

  // Persist on every committed settings change. Done in an effect (not
  // inside the state updater) so the write runs exactly once per render —
  // React 18 strict mode invokes state updaters twice, and any downstream
  // effect that calls `setSettings` mid-cycle would otherwise risk writing
  // stale state. The `initialRef` guard skips the mount write — initial
  // state IS what we just read from storage, no need to echo it back.
  const initialRef = useRef(true)
  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false
      return
    }
    writeToStorage(settings)
  }, [settings])

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== STORAGE_KEY) return
      setSettings(readFromStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setTheme = useCallback((theme: Theme) => {
    setSettings((current) => ({ ...current, theme }))
  }, [])

  const setUserPreferences = useCallback((patch: Partial<UserPreferences>) => {
    setSettings((current) => ({
      ...current,
      userPreferences: { ...current.userPreferences, ...patch },
    }))
  }, [])

  const setNotifications = useCallback((patch: Partial<NotificationPrefs>) => {
    setSettings((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        ...patch,
        categories: {
          ...current.notifications.categories,
          ...(patch.categories ?? {}),
        },
        badgesEnabled: {
          ...current.notifications.badgesEnabled,
          ...(patch.badgesEnabled ?? {}),
        },
        badgeColors: {
          ...current.notifications.badgeColors,
          ...(patch.badgeColors ?? {}),
        },
        gitBadgeSubToggles: {
          ...current.notifications.gitBadgeSubToggles,
          ...(patch.gitBadgeSubToggles ?? {}),
        },
      },
    }))
  }, [])

  const value = useMemo<AppSettingsContextValue>(
    () => ({ settings, setTheme, setUserPreferences, setNotifications }),
    [settings, setTheme, setUserPreferences, setNotifications],
  )

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext)
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider')
  return ctx
}
