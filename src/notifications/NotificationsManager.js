import { ipcMain, Notification } from 'electron';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';
import NotificationsStorage from './NotificationsStorage';
import { settingsManager } from '../managers';

export class NotificationsManager {

  constructor(projectRoot, window) {
    this.projectRoot = projectRoot;
    this.window = window;
    this._ipcBound = false;

    this.storages = {};
  }

  async init() {
    await this.__getStorage('main');

    this._registerIpcHandlers();
  }

  __getStorage(projectId) {
    if (!this.storages[projectId]) {
      const storage = new NotificationsStorage(projectId);
      // Broadcast to renderer on any storage changes
      try {
        storage.subscribe(() => this._broadcast(projectId));
      } catch {}
      this.storages[projectId] = storage;
    }
    return this.storages[projectId];
  }

  _broadcast(projectId) {
    try {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(IPC_HANDLER_KEYS.NOTIFICATIONS_SUBSCRIBE, { projectId });
      }
    } catch (e) {
      // ignore
    }
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {};
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_SEND_OS] = ({args}) => this.sendOs(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_RECENT] = ({projectId}) => this.getRecentNotifications(projectId);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_UNREADCOUNT] = ({projectId}) => this.getUnreadNotificationsCount(projectId);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_MARKALLASREAD] = ({projectId}) => this.markAllNotificationsAsRead(projectId);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_MARKASREAD] = ({projectId, id}) => this.markNotificationAsRead(projectId, id);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_DELETEALL] = ({projectId}) => this.deleteAllNotifications(projectId);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_CREATE] = ({ projectId, input }) => this.createNotification(projectId, input);
    
    for (const handler of Object.keys(handlers)) {
      ipcMain.handle(handler, async (event, args) => {
        try {
          return await handlers[handler](args);
        } catch (e) {
          console.error(`${handler} failed`, e);
          return { ok: false, error: String(e?.message || e) };
        }
      });
    }

    this._ipcBound = true;
  }

  _getPrefsForProject(projectId) {
    try {
      const app = settingsManager?.getAppSettings?.();
      const project = settingsManager?.getProjectSettings?.(projectId);
      const sys = app?.notificationSystemSettings || { osNotificationsEnabled: false, soundsEnabled: false, displayDuration: 5 };
      const categoriesEnabled = project?.notifications?.categoriesEnabled || {};
      return { sys, categoriesEnabled };
    } catch (e) {
      return { sys: { osNotificationsEnabled: false, soundsEnabled: false, displayDuration: 5 }, categoriesEnabled: {} };
    }
  }

  _maybeShowOsNotification(projectId, notification) {
    try {
      const { sys, categoriesEnabled } = this._getPrefsForProject(projectId);
      if (!sys?.osNotificationsEnabled) return;
      if (categoriesEnabled && categoriesEnabled[notification.category] === false) return;

      const data = {
        title: notification.title,
        message: notification.message,
        metadata: {
          ...(notification.metadata || {}),
          projectId,
        },
        soundsEnabled: !!sys?.soundsEnabled,
        displayDuration: Number.isFinite(sys?.displayDuration) ? sys.displayDuration : 5,
      };
      this.sendOs(data);
    } catch (e) {
      // ignore
    }
  }
  
  sendOs(data) {
    if (!Notification.isSupported()) {
      return { success: false, error: 'Notifications not supported' };
    }

    try {
      const notification = new Notification({
        title: data.title,
        body: data.message,
        silent: !data.soundsEnabled,
        timeoutType: data.displayDuration > 0 ? 'default' : 'never',
      });

      notification.on('click', () => {
        if (this.window) {
          try {
            this.window.focus();
            this.window.webContents.send(IPC_HANDLER_KEYS.NOTIFICATIONS_ON_OPEN, data.metadata);
          } catch (_) {
            // Ignore focus/send errors if window is gone
          }
        }
      });

      notification.show();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  createNotification(projectId, input) {
    const storage = this.__getStorage(projectId);
    const created = storage.create(input);
    // Best-effort OS notification based on preferences
    this._maybeShowOsNotification(projectId, created);
    return created;
  }

  getRecentNotifications(projectId) {
    const storage = this.__getStorage(projectId);
    return storage.getRecent();
  }
  getUnreadNotificationsCount(projectId) {
    const storage = this.__getStorage(projectId);
    return storage.getUnread().length;
  }
  markAllNotificationsAsRead(projectId) {
    const storage = this.__getStorage(projectId);
    storage.markAllAsRead();
  }
  markNotificationAsRead(projectId, id) {
    const storage = this.__getStorage(projectId);
    storage.markAsRead(id);
  }
  deleteAllNotifications(projectId) {
    const storage = this.__getStorage(projectId);
    storage.deleteAll();
  }
}
