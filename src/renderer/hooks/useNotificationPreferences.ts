import { useState, useEffect } from 'react';
import type { NotificationSystemPreferences, NotificationProjectPreferences } from '../../types/notifications';
import { useProjectContext } from '../projects/ProjectContext';
import { notificationsService } from '../services/notificationsService';
import { userPreferencesService } from '../services/userPreferencesService';

const DEFAULT_SYSTEM_PREFERENCES: NotificationSystemPreferences = {
  osNotificationsEnabled: true,
  soundsEnabled: true,
  displayDuration: 5
};
const DEFAULT_PROJECT_PREFERENCES: NotificationProjectPreferences = {
  categoriesEnabled: {
    general: true,
    tasks: true,
    chat: true,
    files: true,
    system: true,
    updates: true,
  }
};

export function useNotificationPreferences() {
  const { activeProject } = useProjectContext();
  const [systemPreferences, setSystemPreferences] = useState<NotificationSystemPreferences>(DEFAULT_SYSTEM_PREFERENCES);
  const [projectPreferences, setProjectPreferences] = useState<NotificationProjectPreferences>(DEFAULT_PROJECT_PREFERENCES);

  useEffect(() => {
    const update = async () => {
      const prefs = await userPreferencesService.getNotificationSystemPreferences();
      setSystemPreferences(prefs || DEFAULT_SYSTEM_PREFERENCES);
    };
    update();
  }, []);

  useEffect(() => {
    if (activeProject) {
      const update = async () => {
        setProjectPreferences(await notificationsService.getProjectPreferences(activeProject));
      };
      update();
    }
  }, [activeProject]);

  const updateSystemPreferences = async (updates: Partial<NotificationSystemPreferences>) => {
    const updated = await userPreferencesService.updateNotificationSystemPreferences(updates);
    setSystemPreferences(updated.notifications || DEFAULT_SYSTEM_PREFERENCES);
  };

  const updateProjectPreferences = async (updates: Partial<NotificationProjectPreferences>) => {
    if (activeProject) {
      const newPreferences = await notificationsService.updateProjectPreferences(activeProject, updates);
      setProjectPreferences(newPreferences);
    }
  };

  const changeNotifications = async (enabled: boolean): Promise<boolean> => {
    if (enabled) {
      try {
        const result = await window.notificationsService.sendOs({
          title: 'Notifications Enabled',
          message: 'You will now receive desktop notifications for important events.',
          soundsEnabled: false,
          displayDuration: 5
        });
        if ((result as any).error) {
          // handle error UI if needed
        }
        return (result as any).ok ?? (result as any).success ?? false;
      } catch (_) {
        // handle error UI if needed
      }
    }
    return false;
  };

  return { systemPreferences, updateSystemPreferences, projectPreferences, updateProjectPreferences, changeNotifications };
}
