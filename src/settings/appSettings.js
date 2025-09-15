import AppStorage from './AppStorage'
import { DEFAULT_APP_SETTINGS } from '../types/settings'

export default class AppSettings {
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
      // Deep merge for nested objects we know about to preserve defaults when adding new fields
      const merged = {
        ...DEFAULT_APP_SETTINGS,
        ...parsed,
        userPreferences: {
          ...DEFAULT_APP_SETTINGS.userPreferences,
          ...(parsed.userPreferences || {}),
          shortcuts: {
            ...DEFAULT_APP_SETTINGS.userPreferences.shortcuts,
            ...((parsed.userPreferences && parsed.userPreferences.shortcuts) || {}),
          },
        },
        notificationSystemSettings: {
          ...DEFAULT_APP_SETTINGS.notificationSystemSettings,
          ...(parsed.notificationSystemSettings || {}),
        },
        github: parsed.github ?? DEFAULT_APP_SETTINGS.github,
        webSearchApiKeys: parsed.webSearchApiKeys ?? DEFAULT_APP_SETTINGS.webSearchApiKeys,
        database: {
          ...DEFAULT_APP_SETTINGS.database,
          ...(parsed.database || {}),
        },
      }
      return merged
    } catch {
      return DEFAULT_APP_SETTINGS
    }
  }

  get() {
    return this.settings
  }

  save(updates) {
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
