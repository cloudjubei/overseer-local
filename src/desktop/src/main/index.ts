import { app, BrowserWindow } from 'electron';
import path from 'node:path';

let win: BrowserWindow | null = null;

async function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  if (!app.isPackaged) {
    // In dev, load the Vite dev server
    await win.loadURL(process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173');
  } else {
    // In prod, load the index.html
    await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
