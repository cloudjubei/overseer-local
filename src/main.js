import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { TasksIndexer }  from './tasks/indexer';
import { DocsIndexer } from './docs/indexer';
import { ChatManager } from './chat/manager';

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

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

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
  return await indexer.deleteFeature(taskId, featureId);
});

ipcMain.handle('tasks-features:reorder', async (event, { taskId, payload }) => {
  return await indexer.reorderFeatures(taskId, payload);
});

ipcMain.handle('tasks:add', async (event, task) => {
    return await indexer.addTask(task);
});

ipcMain.handle('tasks:delete', async (event, { taskId }) => {
  return await indexer.deleteTask(taskId);
});

ipcMain.handle('tasks:reorder', async (event, payload) => {
  return await indexer.reorderTasks(payload);
});

ipcMain.handle('docs-index:get', async () => {
  return docsIndexer.getIndex();
});

ipcMain.handle('docs-file:get', async (event, { relPath }) => {
  return await docsIndexer.getFile(relPath);
});
ipcMain.handle('docs-file:save', async (event, { relPath, content }) => {
  return await docsIndexer.saveFile(relPath, content);
});

ipcMain.handle('chat:completion', async (event, {messages, config}) => {
  return await chatManager.getCompletion({messages, config});
});

ipcMain.handle('chat:list-models', async (event, config) => {
  try {
    return await chatManager.listModels(config);
  } catch (error) {
    return { error: error.message };
  }
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
