import AppStorage from './AppStorage'
import { DEFAULT_PROJECT_SETTINGS, ProjectSettings } from '../types/settings'

export default class ProjectSettingsStorage {
  private projectId: string
  private appStorage: AppStorage
  private settings: ProjectSettings

  constructor(projectId: string) {
    this.projectId = projectId
    this.appStorage = new AppStorage('project-settings')
    this.settings = this.__load()
  }

  __storageKey() {
    return `project_settings__${this.projectId}`
  }

  __load() {
    try {
      const stored = this.appStorage.getItem(this.__storageKey())
      return stored ? JSON.parse(stored) : DEFAULT_PROJECT_SETTINGS
    } catch {
      return DEFAULT_PROJECT_SETTINGS
    }
  }

  get() {
    return this.settings
  }

  save(updates: Partial<ProjectSettings>) {
    const newSettings = { ...this.settings, ...updates }
    try {
      this.appStorage.setItem(this.__storageKey(), JSON.stringify(newSettings))
    } catch (error) {
      console.error('Failed to save project settings:', error)
    }
    this.settings = newSettings
    return newSettings
  }
}
