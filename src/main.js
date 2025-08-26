import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { TasksIndexer }  from './tasks/indexer';
import { DocsIndexer } from './docs/indexer';
import { ChatManager } from './chat/manager';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}
let mainWindow;
let indexer;
let docsIndexer;
let chatManager;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // contextIsolation: true,
      // nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();

  const projectRoot = app.getAppPath();
  indexer = new TasksIndexer(projectRoot, mainWindow);
  indexer.init();

  docsIndexer = new DocsIndexer(projectRoot);
  docsIndexer.init();

  chatManager = new ChatManager(projectRoot, indexer, docsIndexer);

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
  if (docsIndexer) {
    docsIndexer.stopWatching();
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

// Removed modal BrowserWindow creation for task/feature modals.
// Modals are now handled entirely in the renderer via Navigator + ModalHost.

ipcMain.handle('docs-index:get', async () => {
  return docsIndexer.getIndex();
});

ipcMain.handle('docs-file:get', async (event, { relPath }) => {
  return await docsIndexer.getFile(relPath);
});
ipcMain.handle('docs-file:save', async (event, { relPath, content }) => {
  return await docsIndexer.saveFile(relPath, content);
});

ipcMain.handle('docs:upload', (event, {name, content}) => {
  const uploadsDir = path.join(docsIndexer.getIndex().docsDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const filePath = path.join(uploadsDir, name);
  fs.writeFileSync(filePath, content);
  docsIndexer.buildIndex();
  return 'uploads/' + name;
});

ipcMain.handle('chat:completion', async (event, {messages, config}) => {
  return await chatManager.getCompletion({messages, config});
});

ipcMain.handle('chat:list', () => {
  return chatManager.listChats();
});

ipcMain.handle('chat:create', () => {
  return chatManager.createChat();
});

ipcMain.handle('chat:load', (event, chatId) => {
  return chatManager.loadChat(chatId);
});

ipcMain.handle('chat:save', (event, {chatId, messages}) => {
  chatManager.saveChat(chatId, messages);
});

ipcMain.handle('chat:delete', (event, chatId) => {
  chatManager.deleteChat(chatId);
});
