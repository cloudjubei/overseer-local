import AppStorage from './AppStorage'
import { AppSettings, DEFAULT_APP_SETTINGS } from '../types/settings'

export default class AppSettingsStorage {
  private appStorage: AppStorage
  private settings: AppSettings
  constructor() {
    this.appStorage = new AppStorage('app-settings')
    this.settings = this.__load()
  }

  __storageKey() {
    return `app_settings`
  }

  __load() {
    try {
      const stored = this.appStorage.getItem(this.__storageKey())
      if (!stored) return DEFAULT_APP_SETTINGS
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_APP_SETTINGS, ...parsed }
    } catch {
      return DEFAULT_APP_SETTINGS
    }
  }

  get() {
    return this.settings
  }

  save(updates: Partial<AppSettings>) {
    const newSettings = { ...this.settings, ...updates }
    try {
      this.appStorage.setItem(this.__storageKey(), JSON.stringify(newSettings))
    } catch (error) {
      console.error('Failed to save app settings:', error)
    }
    this.settings = newSettings
    return newSettings
  }
}
