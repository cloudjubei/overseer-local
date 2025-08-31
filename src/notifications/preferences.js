import AppStorage from './appStorage';

export default class NotificationsPreferences {
  constructor(projectId) {
    this.projectId = projectId;
    this.appStorage = new AppStorage();
    this.preferences = this.__load();
  }

  prefsKey() { return `notification_preferences__${this.projectId}`; }

  __load() {
    try {
      const stored = this.appStorage.getItem(this.prefsKey());
      return stored ? JSON.parse(stored) : { categoriesEnabled: {} };
    } catch {
      return { categoriesEnabled: {} };
    }
  }

  getPreferences() { return this.preferences; }

  savePreferences(updates) {
    const newPrefs = { ...this.preferences, ...updates };
    if (updates.categoriesEnabled) {
      newPrefs.categoriesEnabled = { ...this.preferences.categoriesEnabled, ...updates.categoriesEnabled };
    }
    try {
      this.appStorage.setItem(this.prefsKey(), JSON.stringify(newPrefs));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
    this.preferences = newPrefs;
    return newPrefs;
  }
}
