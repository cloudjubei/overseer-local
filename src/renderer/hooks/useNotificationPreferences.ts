import { useState, useEffect } from 'react';
import type { NotificationPreferences, NotificationCategory } from '../../types/notifications';

const STORAGE_KEY = 'notification_preferences';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  osNotificationsEnabled: true,
  categoriesEnabled: {
    general: true,
    tasks: true,
    chat: true,
    documents: true,
    system: true,
    updates: true,
  },
  soundsEnabled: true,
  displayDuration: 5,
};

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPreferences(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  }, []);

  const updatePreferences = (updates: Partial<NotificationPreferences>) => {
    const newPrefs = { ...preferences, ...updates };
    if (updates.categoriesEnabled) {
      newPrefs.categoriesEnabled = { ...preferences.categoriesEnabled, ...updates.categoriesEnabled };
    }
    setPreferences(newPrefs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  };

  return { preferences, updatePreferences };
}
