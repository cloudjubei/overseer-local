import { useEffect, useState } from 'react'
import { settingsService } from '@renderer/services/settingsService'
import { useProjectContext } from '@renderer/contexts/ProjectContext'
import { NotificationProjectSettings, ProjectSettings } from 'src/types/settings'
import { DEFAULT_PROJECT_SETTINGS } from '@renderer/utils/utils'

export function useProjectSettings() {
  const { activeProject } = useProjectContext()
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(DEFAULT_PROJECT_SETTINGS)

  const update = async () => {
    if (activeProject) {
      const projectSettings = await settingsService.getProjectSettings(activeProject.id)
      updateCurrentProjectSettings(projectSettings)
    }
  }

  const updateCurrentProjectSettings = (projectSettings: ProjectSettings) => {
    setProjectSettings(projectSettings)
  }

  useEffect(() => {
    update()

    const unsubscribe = settingsService.subscribe(updateCurrentProjectSettings)

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    update()
  }, [activeProject])

  const updateProjectSettings = async (
    updates: Partial<ProjectSettings>,
  ): Promise<ProjectSettings | undefined> => {
    if (activeProject) {
      const newProjectSettings = await settingsService.updateProjectSettings(
        activeProject.id,
        updates,
      )
      setProjectSettings(newProjectSettings)
      return newProjectSettings
    }
    return
  }

  const setNotificationProjectSettings = async (
    updates: Partial<NotificationProjectSettings>,
  ): Promise<ProjectSettings | undefined> => {
    const next = {
      ...projectSettings.notifications,
      ...updates,
    }
    return updateProjectSettings({ notifications: next })
  }

  return {
    projectSettings,
    updateProjectSettings,
    setNotificationProjectSettings,
  }
}
