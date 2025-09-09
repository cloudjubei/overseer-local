import AppStorage from './AppStorage';
import { DEFAULT_APP_SETTINGS } from "../types/settings"

export default class AppSettings {
  constructor() {
    this.appStorage = new AppStorage("app-settings");
    this.settings = this.__load();
  }

  __storageKey() { return `app_settings`; }

  __load() {
    try {
      const stored = this.appStorage.getItem(this.__storageKey());
      return stored ? JSON.parse(stored) : DEFAULT_APP_SETTINGS;
    } catch {
      return DEFAULT_APP_SETTINGS;
    }
  }
    
  get() { return this.settings; }

  save(updates) {
    const newSettings = { ...this.settings, ...updates };
    try {
      this.appStorage.setItem(this.__storageKey(), JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save app settings:', error);
    }
    this.settings = newSettings;
    return newSettings;
  }

}
