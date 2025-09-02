import { useEffect, useState } from 'react'
import { settingsService } from '../services/settingsService'
import { AppSettings, DEFAULT_APP_SETTINGS } from '../../types/settings';

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

  return {
    isAppSettingsLoaded: isLoaded,
    appSettings,
    updateAppSettings,
  }
}
