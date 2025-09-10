import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { settingsService } from '../services/settingsService'
import { AppSettings, DEFAULT_APP_SETTINGS, NotificationSystemSettings, UserPreferences } from '../../types/settings'

export type AppSettingsContextValue = {
  isAppSettingsLoaded: boolean
  appSettings: AppSettings
  updateAppSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>
  setUserPreferences: (updates: Partial<UserPreferences>) => Promise<AppSettings>
  setNotificationSystemSettings: (updates: Partial<NotificationSystemSettings>) => Promise<AppSettings>
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null)

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)

  const updateCurrent = (next: AppSettings) => {
    setAppSettings(next)
    setIsLoaded(true)
  }

  useEffect(() => {
    const init = async () => {
      const settings = await settingsService.getAppSettings()
      updateCurrent(settings)
    }
    init()
  }, [])

  const updateAppSettings = useCallback(async (updates: Partial<AppSettings>): Promise<AppSettings> => {
    const newAppSettings = await settingsService.updateAppSettings(updates)
    setAppSettings(newAppSettings)
    return newAppSettings
  }, [])

  const setUserPreferences = useCallback(async (updates: Partial<UserPreferences>): Promise<AppSettings> => {
    const next = {
      ...appSettings.userPreferences,
      ...updates,
    }
    return updateAppSettings({ userPreferences: next })
  }, [appSettings.userPreferences, updateAppSettings])

  const setNotificationSystemSettings = useCallback(async (updates: Partial<NotificationSystemSettings>): Promise<AppSettings> => {
    const next = {
      ...appSettings.notificationSystemSettings,
      ...updates,
    }
    return updateAppSettings({ notificationSystemSettings: next })
  }, [appSettings.notificationSystemSettings, updateAppSettings])

  const value = useMemo<AppSettingsContextValue>(() => ({
    isAppSettingsLoaded: isLoaded,
    appSettings,
    updateAppSettings,
    setUserPreferences,
    setNotificationSystemSettings,
  }), [isLoaded, appSettings, updateAppSettings, setUserPreferences, setNotificationSystemSettings])

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext)
  if (!ctx) throw new Error('useAppSettingsContext must be used within AppSettingsProvider')
  return ctx
}