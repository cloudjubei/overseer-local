import { ipcMain } from 'electron';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';
import ProjectSettings from './ProjectSettings';
import AppSettings from './AppSettings';

export class SettingsManager
{
  constructor(projectRoot, window) {
    this.projectRoot = projectRoot;
    this.window = window;
    
    this.appSettings = new AppSettings()
    this.projectSettings = {};

    this._ipcBound = false;
  }

  async init() {
    await this.__loadProjectSettings('main');

    this._registerIpcHandlers();
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    // Note: ipcMain.handle signature is (event, args). We must read payload from the second param.
    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_GET_APP, (_event) => this.getAppSettings());
    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_UPDATE_APP, (_event, { updates }) => this.updateAppSettings(updates));
    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_GET_PROJECT, (_event, { projectId }) => this.__loadProjectSettings(projectId).get());
    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_UPDATE_PROJECT, (_event, { projectId, updates }) => this.__loadProjectSettings(projectId).save(updates));

    this._ipcBound = true;
  }

  __loadProjectSettings(projectId) {
    if (!this.projectSettings[projectId]) {
      this.projectSettings[projectId] = new ProjectSettings(projectId);
    }
    return this.projectSettings[projectId];
  }

  getAppSettings() {
    return this.appSettings.get()
  }
  
  updateAppSettings(updates) {
    return this.appSettings.save(updates)
  }
  getProjectSettings(projectId) {
    return this.__loadProjectSettings(projectId).get();
  }
}
