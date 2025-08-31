import AppStorage from './appStorage';

export default class NotificationsSystemPreferences {
  constructor() {
    this.appStorage = new AppStorage();
    this.preferences = this.__load();
  }

  prefsKey() { return `notification_system_preferences`; }

  __load() {
    try {
      const stored = this.appStorage.getItem(this.prefsKey());
      return stored ? JSON.parse(stored) : { osNotificationsEnabled: false, soundsEnabled: false, displayDuration: 0 };
    } catch {
      return { osNotificationsEnabled: false, soundsEnabled: false, displayDuration: 0 };
    }
  }

  getPreferences() { return this.preferences; }

  savePreferences(updates) {
    const newPrefs = { ...this.preferences, ...updates };
    try {
      this.appStorage.setItem(this.prefsKey(), JSON.stringify(newPrefs));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
    this.preferences = newPrefs;
    return newPrefs;
  }
}
