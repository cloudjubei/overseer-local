import { ipcMain } from 'electron';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';
import ProjectSettings from './projectSettings';
import AppSettings from './appSettings';

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

    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_GET_APP, () => this.getAppSettings());
    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_UPDATE_APP, ({ updates }) => this.updateAppSettings(updates));
    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_GET_PROJECT, ({projectId}) => this.__loadProjectSettings(projectId).get());
    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_UPDATE_PROJECT, ({ projectId, updates }) => this.__loadProjectSettings(projectId).save(updates));

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
}
