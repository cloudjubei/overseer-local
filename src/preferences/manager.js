import { ipcMain } from 'electron';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';
import UserPreferences from './userPreferences';

export class PreferencesManager {
  constructor() {
    this._ipcBound = false;
    this.preferences = new UserPreferences();
  }

  init() {
    this._registerIpcHandlers();
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    ipcMain.handle(IPC_HANDLER_KEYS.PREFERENCES_GET, () => this.getPreferences());
    ipcMain.handle(IPC_HANDLER_KEYS.PREFERENCES_UPDATE, (event, { updates }) => this.updatePreferences(updates));

    this._ipcBound = true;
  }

  getPreferences() {
    return this.preferences.getPreferences();
  }

  updatePreferences(updates) {
    return this.preferences.updatePreferences(updates);
  }
}
