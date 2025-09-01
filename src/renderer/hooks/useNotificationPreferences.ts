import { useState, useEffect } from 'react';
import type { NotificationProjectPreferences } from '../../types/notifications';
import { useProjectContext } from '../projects/ProjectContext';
import { notificationsService } from '../services/notificationsService';

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

// This hook now only manages project-scoped notification preferences.
// System-wide notification preferences are handled by useAppPreferences.
export function useNotificationPreferences() {
  const { activeProject } = useProjectContext();
  const [projectPreferences, setProjectPreferences] = useState<NotificationProjectPreferences>(DEFAULT_PROJECT_PREFERENCES);

  useEffect(() => {
    const update = async () => {
      if (activeProject) {
        setProjectPreferences(await notificationsService.getProjectPreferences(activeProject));
      }
    };
    update();
  }, [activeProject]);

  const updateProjectPreferences = async (updates: Partial<NotificationProjectPreferences>) => {
    if (activeProject) {
      const newPreferences = await notificationsService.updateProjectPreferences(activeProject, updates);
      setProjectPreferences(newPreferences);
    }
  };

  return { projectPreferences, updateProjectPreferences };
}
