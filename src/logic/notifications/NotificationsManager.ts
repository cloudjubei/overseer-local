import { Notification, app } from 'electron'
import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import NotificationsStorage from './NotificationsStorage'
import SettingsManager from '../settings/SettingsManager'
import BaseManager from '../BaseManager'
import type {
  NotificationCategory,
  Notification as AppNotification,
} from '../../types/notifications'

// If true, read notifications are removed from storage instead of kept as read
const DELETE_READ_NOTIFICATIONS = true

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

  getHandlers(): Record<string, (args: any) => any> {
    const handlers: Record<string, (args: any) => any> = {}

    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_SEND_OS] = ({ args }) => this.sendOs(args)
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_RECENT] = ({ projectId }) =>
      this.getRecentNotifications(projectId)
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_UNREAD] = ({ projectId }) =>
      this.getUnreadNotifications(projectId)
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
          } catch (_) {}
        }
      })

      notification.show()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: String(error) }
    }
  }

  createNotification(projectId: string, input: any): AppNotification {
    try {
      const { notificationsEnabled } = this._getPrefsForProject(projectId)
      const cat = (input?.category || undefined) as NotificationCategory | undefined
      if (cat && notificationsEnabled && notificationsEnabled[cat] === false) {
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

    // Centralized deduplication for ongoing git changes notifications per project
    // If an unread notification exists with the same branch+baseRef, do not create a new one
    try {
      const cat = input?.category as NotificationCategory | undefined
      if (cat === 'git_changes') {
        const md = input?.metadata || {}
        const branch = md.branch
        const baseRef = md.baseRef || 'main'
        if (branch) {
          const existing = storage
            .getUnread()
            .find(
              (n: any) =>
                n.category === 'git_changes' &&
                n?.metadata?.branch === branch &&
                (n?.metadata?.baseRef || 'main') === baseRef,
            )
          if (existing) return existing
        }
      }
    } catch {}

    const created = storage.create(input)
    this._maybeShowOsNotification(projectId, created)
    return created
  }

  getRecentNotifications(projectId: string): AppNotification[] {
    const storage = this.__getStorage(projectId)
    return storage.getRecent()
  }

  getUnreadNotifications(projectId: string): AppNotification[] {
    const storage = this.__getStorage(projectId)
    return storage.getUnread()
  }

  markAllNotificationsAsRead(projectId: string) {
    const storage = this.__getStorage(projectId)
    if (DELETE_READ_NOTIFICATIONS) {
      try {
        const unread = storage.getUnread()
        for (const n of unread) storage.delete(n.id)
      } catch {}
    } else {
      storage.markAllAsRead()
    }
  }

  markNotificationAsRead(projectId: string, id: string) {
    const storage = this.__getStorage(projectId)
    if (DELETE_READ_NOTIFICATIONS) {
      storage.delete(id)
    } else {
      storage.markAsRead(id)
    }
  }

  deleteAllNotifications(projectId: string) {
    const storage = this.__getStorage(projectId)
    storage.deleteAll()
  }

  //TODO: fix this return type
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

  private _maybeShowOsNotification(projectId: string, notification: any) {
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
    } catch (_) {}
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

  private _broadcast(projectId: string) {
    try {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(IPC_HANDLER_KEYS.NOTIFICATIONS_SUBSCRIBE, { projectId })
      }
    } catch (_) {
      // ignore
    }
  }

  private _updateAppBadgeCount() {
    const storages = Object.values(this.storages || {})
    const allowed: Record<string, true> = {
      agent_runs: true,
      chat_messages: true,
      git_changes: true,
    }
    const badgeCount = storages.reduce((acc, s) => {
      const filtered = s.getUnread().filter((n) => allowed[n.category])
      return acc + filtered.length
    }, 0)

    app.setBadgeCount(badgeCount)

    try {
      if (
        process.platform === 'darwin' &&
        (app as any).dock &&
        typeof (app as any).dock.setBadge === 'function'
      ) {
        // (app as any).dock.setBadge(badgeCount > 0 ? String(badgeCount) : '')
      }
    } catch {}
  }
}
