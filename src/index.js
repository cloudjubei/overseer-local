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

  if (process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/main_window/index.html'));
  }
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

ipcMain.handle('tasks:update', async (event, { taskId, data }) => {
  return await indexer.updateTask(taskId, data);
});

ipcMain.handle('tasks-feature:update', async (event, { taskId, featureId, data }) => {
  return await indexer.updateFeature(taskId, featureId, data);
});

ipcMain.handle('tasks-feature:add', async (event, { taskId, feature }) => {
  return await indexer.addFeature(taskId, feature);
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

ipcMain.handle('tasks-features:reorder', async (event, { taskId, payload }) => {
  return await indexer.reorderFeatures(taskId, payload);
});

ipcMain.handle('tasks:add', async (event, task) => {
  return await indexer.addTask(task);
});

ipcMain.handle('tasks:delete', async (event, { taskId }) => {
  if (!indexer) {
    return { ok: false, error: 'Indexer not initialized' };
  }
  try {
    const result = await indexer.deleteTask(taskId);
    return result;
  } catch (error) {
    console.error(`Failed to delete task ${taskId}:`, error);
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('tasks:reorder', async (event, payload) => {
  return await indexer.reorderTasks(payload);
});


const createModalWindow = (options) => {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    modal: true,
    parent: mainWindow,
    ...options.browserWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      ...options.webPreferences,
    },
  });

  if (options.devServerUrl) {
    window.loadURL(options.devServerUrl);
  } else {
    window.loadFile(options.filePath);
  }

  return window;
};

ipcMain.handle('feature-create:open', (event, taskId) => {
  const featureCreateWindow = createModalWindow({
    browserWindow: {
      width: 600,
      height: 800,
      title: 'Create Feature',
    },
    devServerUrl: process.env.FEATURE_CREATE_VITE_DEV_SERVER_URL,
    filePath: path.join(__dirname, '../renderer/feature_create/index.html'),
  });

  featureCreateWindow.webContents.on('did-finish-load', () => {
    featureCreateWindow.webContents.send('set-task-id', taskId);
  });
});

ipcMain.handle('task-create:open', () => {
  createModalWindow({
    browserWindow: {
      width: 600,
      height: 400,
      title: 'Create Task',
    },
    devServerUrl: process.env.TASK_CREATE_VITE_DEV_SERVER_URL,
    filePath: path.join(__dirname, '../renderer/task_create/index.html'),
  });
});