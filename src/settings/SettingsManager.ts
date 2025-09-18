import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import BaseManager from '../BaseManager'
import ProjectSettings from './projectSettings'
import AppSettings from './appSettings'

export default class SettingsManager extends BaseManager {
  private appSettings: AppSettings
  private projectSettings: Record<string, ProjectSettings>

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)

    this.appSettings = new AppSettings()
    this.projectSettings = {}
  }

  async init(): Promise<void> {
    await this.__loadProjectSettings('main')

    await super.init()
  }

  getHandlers(): Record<string, (args: any) => any> {
    const handlers: Record<string, (args: any) => any> = {}

    handlers[IPC_HANDLER_KEYS.SETTINGS_GET_APP] = () => this.getAppSettings()
    handlers[IPC_HANDLER_KEYS.SETTINGS_UPDATE_APP] = ({ updates }) =>
      this.updateAppSettings(updates)
    handlers[IPC_HANDLER_KEYS.SETTINGS_GET_PROJECT] = ({ projectId }) =>
      this.__loadProjectSettings(projectId).get()
    handlers[IPC_HANDLER_KEYS.SETTINGS_UPDATE_PROJECT] = ({ projectId, updates }) =>
      this.__loadProjectSettings(projectId).save(updates)

    return handlers
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
