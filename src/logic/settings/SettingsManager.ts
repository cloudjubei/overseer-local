import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import ProjectSettingsStorage from './ProjectSettingsStorage'
import AppSettingsStorage from './AppSettingsStorage'
import BaseManager from '../BaseManager'
import { AppSettings, ProjectSettings } from '../../types/settings'

export default class SettingsManager extends BaseManager {
  private appSettingsStorage: AppSettingsStorage
  private projectSettingsStorage: Record<string, ProjectSettingsStorage>

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)

    this.appSettingsStorage = new AppSettingsStorage()
    this.projectSettingsStorage = {}
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

  private __loadProjectSettings(projectId: string): ProjectSettingsStorage {
    if (!this.projectSettingsStorage[projectId]) {
      this.projectSettingsStorage[projectId] = new ProjectSettingsStorage(projectId)
    }
    return this.projectSettingsStorage[projectId]
  }

  getAppSettings(): AppSettings {
    return this.appSettingsStorage.get()
  }

  updateAppSettings(updates: any): AppSettings {
    return this.appSettingsStorage.save(updates)
  }
  getProjectSettings(projectId: string): ProjectSettings {
    return this.__loadProjectSettings(projectId).get()
  }
}
