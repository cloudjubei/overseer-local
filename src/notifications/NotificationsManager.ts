import { Notification } from 'electron'
import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import NotificationsStorage from './NotificationsStorage'
import BaseManager from '../BaseManager'
import SettingsManager from '../settings/SettingsManager'

export default class NotificationsManager extends BaseManager {
  private storages: Record<string, NotificationsStorage>
  private settingsManager: SettingsManager

  constructor(projectRoot: string, window: BrowserWindow, settingsManager: SettingsManager) {
    super(projectRoot, window)

    this.storages = {}
    this.settingsManager = settingsManager
  }

  async init(): Promise<void> {
    await this.__getStorage('main')

    await super.init()
  }

  private __getStorage(projectId: string): NotificationsStorage {
    if (!this.storages[projectId]) {
      const storage = new NotificationsStorage(projectId)
      // Broadcast to renderer on any storage changes
      try {
        storage.subscribe(() => this._broadcast(projectId))
      } catch {}
      this.storages[projectId] = storage
    }
    return this.storages[projectId]
  }

  private _broadcast(projectId: string): void {
    try {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(IPC_HANDLER_KEYS.NOTIFICATIONS_SUBSCRIBE, { projectId })
      }
    } catch (e) {
      // ignore
    }
  }

  getHandlers(): Record<string, (args: any) => any> {
    const handlers: Record<string, (args: any) => any> = {}

    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_SEND_OS] = ({ args }) => this.sendOs(args)
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_RECENT] = ({ projectId }) =>
      this.getRecentNotifications(projectId)
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_UNREADCOUNT] = ({ projectId }) =>
      this.getUnreadNotificationsCount(projectId)
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_MARKALLASREAD] = ({ projectId }) =>
      this.markAllNotificationsAsRead(projectId)
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_MARKASREAD] = ({ projectId, id }) =>
      this.markNotificationAsRead(projectId, id)
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_DELETEALL] = ({ projectId }) =>
      this.deleteAllNotifications(projectId)
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_CREATE] = ({ projectId, input }) =>
      this.createNotification(projectId, input)

    return handlers
  }

  private _getPrefsForProject(projectId: string): any {
    try {
      const app = this.settingsManager.getAppSettings?.()
      const project = this.settingsManager.getProjectSettings?.(projectId)
      const sys = app?.settings || {
        osNotificationsEnabled: false,
        soundsEnabled: false,
        displayDuration: 5,
      }
      const categoriesEnabled = project?.settings.notifications?.categoriesEnabled || {}
      return { sys, categoriesEnabled }
    } catch (e) {
      return {
        sys: { osNotificationsEnabled: false, soundsEnabled: false, displayDuration: 5 },
        categoriesEnabled: {},
      }
    }
  }

  private _maybeShowOsNotification(projectId: string, notification: any): void {
    try {
      const { sys, categoriesEnabled } = this._getPrefsForProject(projectId)
      if (!sys?.osNotificationsEnabled) return
      if (categoriesEnabled && categoriesEnabled[notification.category] === false) return

      const data = {
        title: notification.title,
        message: notification.message,
        metadata: {
          ...(notification.metadata || {}),
          projectId,
        },
        soundsEnabled: !!sys?.soundsEnabled,
        displayDuration: Number.isFinite(sys?.displayDuration) ? sys.displayDuration : 5,
      }
      this.sendOs(data)
    } catch (e) {
      // ignore
    }
  }

  sendOs(data: any): { success: boolean; error?: string } {
    if (!Notification.isSupported()) {
      return { success: false, error: 'Notifications not supported' }
    }

    try {
      const notification = new Notification({
        title: data.title,
        body: data.message,
        silent: !data.soundsEnabled,
        timeoutType: data.displayDuration > 0 ? 'default' : 'never',
      })

      notification.on('click', () => {
        if (this.window) {
          try {
            this.window.focus()
            this.window.webContents.send(IPC_HANDLER_KEYS.NOTIFICATIONS_ON_OPEN, data.metadata)
          } catch (_) {
            // Ignore focus/send errors if window is gone
          }
        }
      })

      notification.show()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: String(error) }
    }
  }

  createNotification(projectId: string, input: any): any {
    const storage = this.__getStorage(projectId)
    const created = storage.create(input)
    // Best-effort OS notification based on preferences
    this._maybeShowOsNotification(projectId, created)
    return created
  }

  getRecentNotifications(projectId: string): any[] {
    const storage = this.__getStorage(projectId)
    return storage.getRecent()
  }
  getUnreadNotificationsCount(projectId: string): number {
    const storage = this.__getStorage(projectId)
    return storage.getUnread().length
  }
  markAllNotificationsAsRead(projectId: string): void {
    const storage = this.__getStorage(projectId)
    storage.markAllAsRead()
  }
  markNotificationAsRead(projectId: string, id: string): void {
    const storage = this.__getStorage(projectId)
    storage.markAsRead(id)
  }
  deleteAllNotifications(projectId: string): void {
    const storage = this.__getStorage(projectId)
    storage.deleteAll()
  }
}
