import { ipcMain, Notification } from 'electron';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';
import NotificationsStorage from './storage';

export class NotificationManager {

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
      this.storages[projectId] = new NotificationsStorage(projectId);
    }
    return this.storages[projectId];
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {};
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_SEND_OS] = (args) => this.sendOs(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_RECENT] = (args) => this.getRecentNotifications(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_UNREADCOUNT] = (args) => this.getUnreadNotificationsCount(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_MARKALLASREAD] = (args) => this.markAllNotificationsAsRead(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_MARKASREAD] = (args) => this.markNotificationAsRead(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_DELETEALL] = (args) => this.deleteAllNotifications(args);
    
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

  //TODO: on create call ->
  // __showOsNotification(notification) {
  //   const prefs = this.getPreferences();
  //   if (!prefs.osNotificationsEnabled) return;
  //   if (prefs.categoriesEnabled && !prefs.categoriesEnabled[notification.category]) return;

  //   const data = {
  //     title: notification.title,
  //     message: notification.message,
  //     metadata: {
  //       ...(notification.metadata || {}),
  //       projectId: this.currentProjectId,
  //     },
  //     soundsEnabled: prefs.soundsEnabled,
  //     displayDuration: prefs.displayDuration
  //   };

  //   try {
  //     //TODO:
  //     await window.notifications.sendOs(data);
  //   } catch (error) {
  //     console.error('Failed to send OS notification:', error);
  //   }
  // }
  
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

  getRecentNotifications({ project }) {
    const storage = this.__getStorage(project.id);
    return storage.getRecent();
  }
  getUnreadNotificationsCount({ project }) {
    const storage = this.__getStorage(project.id);
    return storage.getUnread().length;
  }
  markAllNotificationsAsRead({ project }) {
    const storage = this.__getStorage(project.id);
    storage.markAllAsRead();
  }
  markNotificationAsRead({ project, id }) {
    const storage = this.__getStorage(project.id);
    storage.markAsRead(id);
  }
  deleteAllNotifications({ project }) {
    const storage = this.__getStorage(project.id);
    storage.deleteAll();
  }
}
