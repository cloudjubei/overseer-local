import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { settingsService } from '../services/settingsService';
import { AppSettings, DEFAULT_APP_SETTINGS, NotificationSystemSettings, UserPreferences } from '../../types/settings';

export type AppSettingsContextValue = {
  isAppSettingsLoaded: boolean;
  appSettings: AppSettings;
  updateAppSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>;
  setUserPreferences: (updates: Partial<UserPreferences>) => Promise<AppSettings>;
  setNotificationSystemSettings: (updates: Partial<NotificationSystemSettings>) => Promise<AppSettings>;
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      const s = await settingsService.getAppSettings();
      if (!mounted) return;
      setAppSettings(s);
      setIsLoaded(true);
    };
    update();
    return () => {
      mounted = false;
    };
  }, []);

  const updateAppSettings = async (updates: Partial<AppSettings>): Promise<AppSettings> => {
    const newAppSettings = await settingsService.updateAppSettings(updates);
    setAppSettings(newAppSettings);
    return newAppSettings;
  };

  const setUserPreferences = async (updates: Partial<UserPreferences>): Promise<AppSettings> => {
    const next = {
      ...appSettings.userPreferences,
      ...updates,
    };
    return updateAppSettings({ userPreferences: next });
  };

  const setNotificationSystemSettings = async (
    updates: Partial<NotificationSystemSettings>
  ): Promise<AppSettings> => {
    const next = {
      ...appSettings.notificationSystemSettings,
      ...updates,
    };
    return updateAppSettings({ notificationSystemSettings: next });
  };

  const value: AppSettingsContextValue = useMemo(
    () => ({
      isAppSettingsLoaded: isLoaded,
      appSettings,
      updateAppSettings,
      setUserPreferences,
      setNotificationSystemSettings,
    }),
    [isLoaded, appSettings]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettingsContext() {
  return useContext(AppSettingsContext);
}
