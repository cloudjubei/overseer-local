import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const PREFERENCES_FILE = 'user-preferences.json';

const DEFAULT_PREFERENCES = {
  lastActiveProjectId: null,
  tasksViewMode: 'list',
  tasksListView: {
    sortBy: 'order',
    sortDirection: 'asc',
  },
  notifications: {
    osNotificationsEnabled: true,
    soundsEnabled: true,
    displayDuration: 5,
  }
};

class UserPreferences {
  constructor() {
    this.preferencesPath = path.join(app.getPath('userData'), PREFERENCES_FILE);
    this.preferences = this._loadPreferences();
  }

  _loadPreferences() {
    try {
      if (fs.existsSync(this.preferencesPath)) {
        const rawData = fs.readFileSync(this.preferencesPath);
        return JSON.parse(rawData);
      } else {
        return DEFAULT_PREFERENCES;
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  }

  _savePreferences() {
    try {
      fs.writeFileSync(this.preferencesPath, JSON.stringify(this.preferences, null, 2));
    } catch (error) {
      console.error('Error saving user preferences:', error);
    }
  }

  getPreferences() {
    return this.preferences;
  }

  updatePreferences(updates) {
    this.preferences = { ...this.preferences, ...updates };
    this._savePreferences();
    return this.preferences;
  }
}

export default UserPreferences;
