import { ipcMain, Notification } from 'electron';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';
import NotificationsStorage from './storage';
import NotificationsPreferences from './preferences';
import NotificationsSystemPreferences from './systemPreferences';

export class NotificationManager {

  constructor(projectRoot, window) {
    this.projectRoot = projectRoot;
    this.window = window;
    this._ipcBound = false;

    this.storages = {};
    this.systemPreferences = new NotificationsSystemPreferences();
    this.preferences = {};
  }

  __getStorage(projectId) {
    if (!this.storages[projectId]) {
      this.storages[projectId] = new NotificationsStorage(projectId);
    }
    return this.storages[projectId];
  }
  __getPreferences(projectId) {
    if (!this.preferences[projectId]) {
      this.preferences[projectId] = new NotificationsPreferences(projectId);
    }
    return this.preferences[projectId];
  }

  async init() {
    this.__getStorage('main');
    this.__getPreferences('main');

    this._registerIpcHandlers();
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
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_PREFERENCES_SYSTEM] = (args) => this.getSystemPreferences(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_PREFERENCES_SYSTEM_UPDATE] = (args) => this.updateSystemPreferences(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_PREFERENCES_PROJECT] = (args) => this.getProjectPreferences(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_PREFERENCES_PROJECT_UPDATE] = (args) => this.updateProjectPreferences(args);

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

  sendOs(data) {
    if (!Notification.isSupported()) {
      return { success: false, error: 'Notifications not supported' };
    }

    try {
      const notification = new Notification({
        title: data.title,
        body: data.message,
        silent: !data.soundsEnabled,
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

  getSystemPreferences() {
    return this.systemPreferences.getPreferences();
  }
  updateSystemPreferences({ updates }) {
    return this.systemPreferences.savePreferences(updates);
  }
  getProjectPreferences({ project }) {
    return this.__getPreferences(project.id).getPreferences();
  }
  updateProjectPreferences({ project, updates }) {
    const preferences = this.__getPreferences(project.id);
    return preferences.savePreferences(updates);
  }
}
