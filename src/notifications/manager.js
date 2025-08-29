import { ipcMain, Notification } from 'electron';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';

export class NotificationManager {
  constructor(projectRoot, window) {
    this.projectRoot = projectRoot;
    this.window = window;
    this._ipcBound = false;
  }

  setWindow(window) {
    this.window = window;
  }

  async init() {
    this._registerIpcHandlers();
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    ipcMain.handle(IPC_HANDLER_KEYS.NOTIFICATIONS_SEND_OS, async (event, data) => {
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
              this.window.webContents.send(IPC_HANDLER_KEYS.NOTIFICATIONS_CLICKED, data.metadata);
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
    });

    this._ipcBound = true;
  }

  // For symmetry with other managers; no watchers here.
  stop() {}
}
