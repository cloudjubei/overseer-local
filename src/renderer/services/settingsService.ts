import { AppSettings, ProjectSettings } from "../../types/settings"

export type SettingsService = {
  getAppSettings: () => Promise<AppSettings>
  updateAppSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>
  
  subscribe: (callback: (settngs: ProjectSettings) => void) => () => void
  getProjectSettings: (projectId: string) => Promise<ProjectSettings>
  updateProjectSettings: (projectId: string, updates: Partial<ProjectSettings>) => Promise<ProjectSettings>
}

export const settingsService: SettingsService = { ...window.settingsService }
