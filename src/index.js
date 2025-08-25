const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { TasksIndexer } = require('./tasks/indexer');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let indexer = null;

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Push index updates to renderer
  if (indexer) {
    const sendUpdate = () => {
      try {
        mainWindow.webContents.send('tasks-index:update', indexer.getIndex());
      } catch (_) {}
    };
    sendUpdate();
    indexer.on('updated', sendUpdate);
    mainWindow.on('closed', () => {
      if (indexer) indexer.removeListener('updated', sendUpdate);
    });
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Resolve project root: one level up from src/ in dev
  const projectRoot = path.resolve(__dirname, '..');
  indexer = new TasksIndexer(projectRoot);
  await indexer.init();

  ipcMain.handle('tasks-index:get', () => {
    return indexer ? indexer.getIndex() : null;
  });

  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (indexer) indexer.stopWatching();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
