import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import type { BaseManager } from '../managers'
import ProjectSettings from './projectSettings'
import AppSettings from './appSettings'

export default class SettingsManager implements BaseManager {
  private projectRoot: string
  private window: BrowserWindow

  private appSettings: AppSettings
  private projectSettings: Record<string, ProjectSettings>

  private _ipcBound: boolean

  constructor(projectRoot: string, window: BrowserWindow) {
    this.projectRoot = projectRoot
    this.window = window

    this.appSettings = new AppSettings()
    this.projectSettings = {}

    this._ipcBound = false
  }

  async init(): Promise<void> {
    await this.__loadProjectSettings('main')

    this._registerIpcHandlers()
  }

  private _registerIpcHandlers(): void {
    if (this._ipcBound) return

    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_GET_APP, () => this.getAppSettings())
    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_UPDATE_APP, (_event, { updates }) =>
      this.updateAppSettings(updates),
    )
    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_GET_PROJECT, (_event, { projectId }) =>
      this.__loadProjectSettings(projectId).get(),
    )
    ipcMain.handle(IPC_HANDLER_KEYS.SETTINGS_UPDATE_PROJECT, (_event, { projectId, updates }) =>
      this.__loadProjectSettings(projectId).save(updates),
    )

    this._ipcBound = true
  }

  private __loadProjectSettings(projectId: string): ProjectSettings {
    if (!this.projectSettings[projectId]) {
      this.projectSettings[projectId] = new ProjectSettings(projectId)
    }
    return this.projectSettings[projectId]
  }

  getAppSettings(): AppSettings {
    return this.appSettings.get()
  }

  updateAppSettings(updates: any): AppSettings {
    return this.appSettings.save(updates)
  }
  getProjectSettings(projectId: string): ProjectSettings {
    return this.__loadProjectSettings(projectId).get()
  }
}
