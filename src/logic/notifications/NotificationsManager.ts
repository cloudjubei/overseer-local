import { Notification, app } from 'electron'
import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import NotificationsStorage from './NotificationsStorage'
import SettingsManager from '../settings/SettingsManager'
import BaseManager from '../BaseManager'
import type { NotificationCategory } from '../../types/notifications'

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
    // Ensure dock/app badge reflects persisted unread notifications on startup
    this._updateAppBadgeCount()
  }

  private __getStorage(projectId: string): NotificationsStorage {
    if (!this.storages[projectId]) {
      const storage = new NotificationsStorage(projectId)
      storage.subscribe(() => {
        this._broadcast(projectId)
        this._updateAppBadgeCount()
      })
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

  private _updateAppBadgeCount(): void {
    try {
      const storages = Object.values(this.storages || {})
      const unreadTotal = storages.reduce((acc, s: any) => {
        try {
          if (typeof s.getUnreadCount === 'function') return acc + s.getUnreadCount()
          if (typeof s.getUnread === 'function') return acc + s.getUnread().length
          return acc
        } catch {
          return acc
        }
      }, 0)

      try {
        if (typeof (app as any).setBadgeCount === 'function') {
          app.setBadgeCount(unreadTotal)
        }
      } catch {}

      if (
        process.platform === 'darwin' &&
        (app as any).dock &&
        typeof (app as any).dock.setBadge === 'function'
      ) {
        try {
          ;(app as any).dock.setBadge(unreadTotal > 0 ? String(unreadTotal) : '')
        } catch {}
      }
    } catch {
      // ignore badge errors
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

  private _getPrefsForProject(projectId: string): {
    sys: { osNotificationsEnabled: boolean; soundsEnabled: boolean; displayDuration: number }
    notificationsEnabled: Record<NotificationCategory, boolean>
    badgesEnabled: Record<NotificationCategory, boolean>
  } {
    try {
      const appSettings = this.settingsManager.getAppSettings?.()
      const project = this.settingsManager.getProjectSettings?.(projectId)
      const sys = appSettings?.notificationSystemSettings || {
        osNotificationsEnabled: false,
        soundsEnabled: false,
        displayDuration: 5,
      }
      const n = project?.notifications || {}
      const notificationsEnabled = n.notificationsEnabled || {
        agent_runs: true,
        chat_messages: true,
        git_changes: true,
      }
      const badgesEnabled = n.badgesEnabled || {
        agent_runs: true,
        chat_messages: true,
        git_changes: true,
      }
      return { sys, notificationsEnabled, badgesEnabled }
    } catch (e) {
      return {
        sys: { osNotificationsEnabled: false, soundsEnabled: false, displayDuration: 5 },
        notificationsEnabled: { agent_runs: true, chat_messages: true, git_changes: true },
        badgesEnabled: { agent_runs: true, chat_messages: true, git_changes: true },
      }
    }
  }

  private _maybeShowOsNotification(projectId: string, notification: any): void {
    try {
      const { sys, notificationsEnabled } = this._getPrefsForProject(projectId)
      if (!sys?.osNotificationsEnabled) return
      if (notificationsEnabled && notificationsEnabled[notification.category] === false) return

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
        icon: 'resources/icon.png',
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
    // Do not create/store when notifications for this category are disabled
    try {
      const { notificationsEnabled } = this._getPrefsForProject(projectId)
      const cat = (input?.category || undefined) as NotificationCategory | undefined
      if (cat && notificationsEnabled && notificationsEnabled[cat] === false) {
        // Return a harmless stub so callers awaiting the promise do not break.
        return {
          id: 'skipped',
          timestamp: Date.now(),
          type: input.type,
          category: cat,
          title: input.title,
          message: input.message,
          read: true,
          metadata: { ...(input.metadata || {}), projectId },
        }
      }
    } catch {}
    const storage = this.__getStorage(projectId)
    const created = storage.create(input)
    // Best-effort OS notification based on preferences
    this._maybeShowOsNotification(projectId, created)
    // Badge will update via subscription; no extra call needed
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
    // Badge updates via subscription
  }
  markNotificationAsRead(projectId: string, id: string): void {
    const storage = this.__getStorage(projectId)
    storage.markAsRead(id)
    // Badge updates via subscription
  }
  deleteAllNotifications(projectId: string): void {
    const storage = this.__getStorage(projectId)
    storage.deleteAll()
    // Badge updates via subscription
  }
}
