import { AppSettings, ProjectSettings } from "../../types/settings"

export type SettingsService = {
  subscribe: (callback: (settngs: ProjectSettings) => void) => () => void
  getAppSettings: () => Promise<AppSettings>
  updateAppSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>
  getProjectSettings: (projectId: string) => Promise<ProjectSettings>
  updateProjectSettings: (projectId: string, updates: Partial<ProjectSettings>) => Promise<ProjectSettings>
}

export const settingsService: SettingsService = { ...window.settingsService }
