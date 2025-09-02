import { useEffect, useState } from 'react'
import { settingsService } from '../services/settingsService'
import { useProjectContext } from '../projects/ProjectContext'
import { DEFAULT_PROJECT_SETTINGS, ProjectSettings } from '../../types/settings'

export function useProjectSettings() {
  const {
    activeProject
  } = useProjectContext()
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(DEFAULT_PROJECT_SETTINGS)


  const update = async () => {
    if (activeProject) {
      const projectSettings = await settingsService.getProjectSettings(activeProject.id);
      updateCurrentProjectSettings(projectSettings);
    }
  };

  const updateCurrentProjectSettings = (projectSettings: ProjectSettings) => {
    setProjectSettings(projectSettings);
  };

  useEffect(() => {
    update();

    const unsubscribe = settingsService.subscribe(updateCurrentProjectSettings);

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    update();
  }, [activeProject]);

  const updateProjectSettings = async (updates: Partial<ProjectSettings>) : Promise<ProjectSettings | undefined> => {
    if (activeProject){
      const newProjectSettings = await settingsService.updateProjectSettings(activeProject.id, updates)
      setProjectSettings(newProjectSettings)
      return newProjectSettings
    }
  }

  return {
    projectSettings,
    updateProjectSettings,
  }
}
