import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerScreenshotService } from './capture/screenshotService';
import { initManagers, taskManager, fileManager, projectManager } from './managers';

if (started) {
  app.quit();
}
let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.webContents.openDevTools();
};

app.whenReady().then(async () => {
  createWindow();

  registerScreenshotService(() => mainWindow);

  const projectRoot = app.getAppPath();

  await initManagers(projectRoot, mainWindow);
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  if (taskManager) { taskManager.stopWatching(); }
  if (fileManager) { fileManager.stopWatching(); }
  if (projectManager) { projectManager.stopWatching(); }
});

// Notifications
ipcMain.handle('notifications:send-os', async (event, data) => {
  
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
      mainWindow.focus();
      mainWindow.webContents.send('notifications:clicked', data.metadata);
    });

    notification.show();
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
