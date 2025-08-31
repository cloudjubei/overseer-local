
export default class NotificationsPreferences
{
  constructor(projectId) {
    this.projectId = projectId

    this.preferences = this.__load()
  }

  prefsKey() { return `notification_preferences__${this.projectId}`; }

  __load()
  {
    try {
      const stored = localStorage.getItem(this.prefsKey());
      return stored ? JSON.parse(stored) : { categoriesEnabled: {} };
    } catch {
      return { categoriesEnabled: {} };
    }
  }

  getPreferences() { return this.preferences }

  savePreferences(updates)
  {
    const newPrefs = { ...preferences, ...updates };
    if (updates.categoriesEnabled) {
      newPrefs.categoriesEnabled = { ...preferences.categoriesEnabled, ...updates.categoriesEnabled };
    }
    try {
      localStorage.setItem(this.prefsKey(), JSON.stringify(newPrefs));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
    this.preferences = newPrefs
    return newPrefs
  }
}
