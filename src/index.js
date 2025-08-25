const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { TasksIndexer } = require('./tasks/indexer');

let mainWindow;
let indexer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  const projectRoot = path.join(app.getAppPath(), '..'); 
  indexer = new TasksIndexer(projectRoot, mainWindow);
  indexer.init();

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
  if (indexer) {
      indexer.stopWatching();
  }
});

ipcMain.handle('tasks-index:get', async () => {
    return indexer.getIndex();
});

ipcMain.handle('tasks-feature:delete', async (event, { taskId, featureId }) => {
  if (!indexer) {
    return { ok: false, error: 'Indexer not initialized' };
  }
  try {
    const result = await indexer.deleteFeature(taskId, featureId);
    return result;
  } catch (error) {
    console.error(`Failed to delete feature ${featureId} from task ${taskId}:`, error);
    return { ok: false, error: error.message };
  }
});
