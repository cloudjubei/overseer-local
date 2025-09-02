import { useEffect, useState } from 'react'
import { settingsService } from '../services/settingsService'
import { AppSettings, DEFAULT_APP_SETTINGS, TaskListViewSorting, TaskViewMode } from '../../types/settings';

export function useAppSettings() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)

  useEffect(() => {
    const update = async () => {
      const appSettings = await settingsService.getAppSettings();
      setAppSettings(appSettings)
      setIsLoaded(true)
    }
    update()
  }, []);

  const updateAppSettings = async (updates: Partial<AppSettings>) : Promise<AppSettings> => {
    const newAppSettings = await settingsService.updateAppSettings(updates)
    setAppSettings(newAppSettings)
    return newAppSettings
  }

  // Convenience helpers for nested userPreferences updates
  const setTasksViewMode = async (mode: TaskViewMode): Promise<AppSettings> => {
    const next = {
      ...appSettings,
      userPreferences: {
        ...appSettings.userPreferences,
        tasksViewMode: mode,
      },
    }
    return updateAppSettings(next)
  }

  const setTasksListViewSorting = async (sorting: TaskListViewSorting): Promise<AppSettings> => {
    const next = {
      ...appSettings,
      userPreferences: {
        ...appSettings.userPreferences,
        tasksListViewSorting: sorting,
      },
    }
    return updateAppSettings(next)
  }

  return {
    isAppSettingsLoaded: isLoaded,
    appSettings,
    updateAppSettings,
    setTasksViewMode,
    setTasksListViewSorting,
  }
}
