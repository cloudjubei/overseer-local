import { ipcMain, Notification } from 'electron';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';
import NotificationsStorage from './storage';
import NotificationsPreferences from './preferences';
import UserPreferences from '../preferences/userPreferences';

export class NotificationManager {

  constructor(projectRoot, window) {
    this.projectRoot = projectRoot;
    this.window = window;
    this._ipcBound = false;

    this.storages = {};
    // Use centralized user preferences for system-level notification preferences
    this.userPreferences = new UserPreferences();
    this.preferences = {};
  }

  async init() {
    await this.__getStorage('main');
    await this.__getPreferences('main');

    this._registerIpcHandlers();
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

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {};
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_SEND_OS] = (args) => this.sendOs(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_RECENT] = (args) => this.getRecentNotifications(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_UNREADCOUNT] = (args) => this.getUnreadNotificationsCount(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_MARKALLASREAD] = (args) => this.markAllNotificationsAsRead(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_MARKASREAD] = (args) => this.markNotificationAsRead(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_DELETEALL] = (args) => this.deleteAllNotifications(args);
    // System preferences (now backed by centralized user preferences)
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_PREFERENCES_SYSTEM] = (args) => this.getSystemPreferences(args);
    handlers[IPC_HANDLER_KEYS.NOTIFICATIONS_PREFERENCES_SYSTEM_UPDATE] = (args) => this.updateSystemPreferences(args);
    // Project-scoped notification preferences remain project-specific
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

  // System preferences via centralized user preferences
  getSystemPreferences() {
    const prefs = this.userPreferences.getPreferences();
    return prefs.notifications || { osNotificationsEnabled: true, soundsEnabled: true, displayDuration: 5 };
  }
  updateSystemPreferences({ updates }) {
    const current = this.userPreferences.getPreferences();
    const updatedNotifications = { ...(current.notifications || {}), ...(updates || {}) };
    this.userPreferences.updatePreferences({ notifications: updatedNotifications });
    return updatedNotifications;
  }

  // Project-scoped notification preferences remain in notifications storage
  getProjectPreferences({ project }) {
    return this.__getPreferences(project.id).getPreferences();
  }
  updateProjectPreferences({ project, updates }) {
    const preferences = this.__getPreferences(project.id);
    return preferences.savePreferences(updates);
  }
}
