import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { validateProjectSpec } from './projects/validator';
import { registerScreenshotService } from './capture/screenshotService';
import { initManagers, taskManager, fileManager, projectManager, chatManager } from './managers';

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

// Helper to resolve current files base directory
function getFilesBaseDir() {
  try {
    const snap = fileManager.getIndex();
    // Prefer explicit properties; fall back to manager internal or project root
    return snap.filesDir || snap.root || fileManager.filesDir || app.getAppPath();
  } catch {
    return app.getAppPath();
  }
}

// Tasks
ipcMain.handle('tasks-index:get', async () => {
  return taskManager.getIndex();
});

ipcMain.handle('tasks:set-context', async (event, { projectId }) => {
  try {
    // Compute tasks directory based on projectId
    let targetDir;
    if (!projectId || projectId === 'main') {
      targetDir = taskManager.getDefaultTasksDir();
    } else {
      const snap = projectManager.getIndex();
      const spec = snap.projectsById?.[projectId];
      const projectsDirAbs = path.resolve(snap.projectsDir);
      if (spec) {
        const projectAbs = path.resolve(projectsDirAbs, spec.path);
        targetDir = path.join(projectAbs, 'tasks');
      } else {
        // Fallback to main if project not found
        targetDir = taskManager.getDefaultTasksDir();
      }
    }
    const res = await taskManager.setTasksDir(targetDir);
    return res;
  } catch (e) {
    console.error('Failed to set tasks context:', e);
    return taskManager.getIndex();
  }
});

ipcMain.handle('tasks:update', async (event, { taskId, data }) => {
  return await taskManager.updateTask(taskId, data);
});

ipcMain.handle('tasks-feature:update', async (event, { taskId, featureId, data }) => {
  return await taskManager.updateFeature(taskId, featureId, data);
});

ipcMain.handle('tasks-feature:add', async (event, { taskId, feature }) => {
  return await taskManager.addFeature(taskId, feature);
});

ipcMain.handle('tasks-feature:delete', async (event, { taskId, featureId }) => {
  return await taskManager.deleteFeature(taskId, featureId);
});

ipcMain.handle('tasks-features:reorder', async (event, { taskId, payload }) => {
  return await taskManager.reorderFeatures(taskId, payload);
});

ipcMain.handle('tasks:add', async (event, task) => {
    return await taskManager.addTask(task);
});

ipcMain.handle('tasks:delete', async (event, { taskId }) => {
  return await taskManager.deleteTask(taskId);
});

ipcMain.handle('tasks:reorder', async (event, payload) => {
  return await taskManager.reorderTasks(payload);
});


// Files — unified index used by renderer FileService
ipcMain.handle('files-index:get', async () => {
  return fileManager.getIndex();
});

ipcMain.handle('files:set-context', async (event, { projectId }) => {
  try {
    let targetDir;
    if (!projectId || projectId === 'main') {
      targetDir = fileManager.getDefaultFilesDir();
    } else {
      const snap = projectManager.getIndex();
      const spec = snap.projectsById?.[projectId];
      const projectsDirAbs = path.resolve(snap.projectsDir);
      if (spec) {
        targetDir = path.resolve(projectsDirAbs, spec.path);
      } else {
        targetDir = fileManager.getDefaultFilesDir();
      }
    }
    const res = await fileManager.setFilesDir(targetDir);
    return res;
  } catch (e) {
    console.error('Failed to set files context:', e);
    return fileManager.getIndex();
  }
});

// Files content bridges for renderer FileService (optional best-effort bridges)
ipcMain.handle('files:read', async (event, { relPath, encoding }) => {
  const base = getFilesBaseDir();
  const abs = path.join(base, relPath);
  const data = fs.readFileSync(abs);
  if (encoding) return data.toString(encoding);
  return data; // Buffer will be serialized by Electron
});

ipcMain.handle('files:read-binary', async (event, { relPath }) => {
  const base = getFilesBaseDir();
  const abs = path.join(base, relPath);
  return fs.readFileSync(abs);
});

ipcMain.handle('files:ensure-dir', async (event, { relPath }) => {
  const base = getFilesBaseDir();
  const abs = path.join(base, relPath);
  if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
  return { ok: true };
});

ipcMain.handle('files:write', async (event, { relPath, content, encoding = 'utf8' }) => {
  const base = getFilesBaseDir();
  const abs = path.join(base, relPath);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, content, encoding);
  // ask manager to rebuild so UI updates (it may already watch and emit)
  if (typeof fileManager.rebuildAndNotify === 'function') {
    await fileManager.rebuildAndNotify('File written via IPC');
  }
  return { ok: true };
});
ipcMain.handle('files:delete', async (event, { relPath }) => {
  const base = getFilesBaseDir();
  const abs = path.join(base, relPath);
  if (fs.lstatSync(abs).isDirectory()){
    fs.rmdirSync(abs)
  }else{
    fs.unlinkSync(abs)
  }
});
ipcMain.handle('files:rename', async (event, { relPathSource, relPathTarget }) => {
  const base = getFilesBaseDir();
  const absSource = path.join(base, relPathSource);
  const absTarget = path.join(base, relPathTarget);
  fs.renameSync(absSource, absTarget)
});

ipcMain.handle('files:upload', (event, { name, content }) => {
  const base = getFilesBaseDir();
  const uploadsDir = path.join(base, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const filePath = path.join(uploadsDir, name);
  fs.writeFileSync(filePath, content, 'utf8');
  if (typeof fileManager.buildIndex === 'function') {
    fileManager.buildIndex();
  }
  return 'uploads/' + name;
});



// Projects
ipcMain.handle('projects-index:get', async () => {
  return projectManager.getIndex();
});

function ensureProjectsDirExists() {
  const dir = projectManager.getIndex().projectsDir;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getProjectConfigPathForId(id) {
  const snap = projectManager.getIndex();
  const rel = snap.configPathsById?.[id];
  if (rel) return path.join(snap.projectsDir, rel);
  // default convention: projects/<id>.json
  return path.join(snap.projectsDir, `${id}.json`);
}

ipcMain.handle('projects:create', async (event, { spec }) => {
  try {
    const sanitized = { ...spec };
    if (!Array.isArray(sanitized.requirements)) sanitized.requirements = [];
    const { valid, errors } = validateProjectSpec(sanitized);
    if (!valid) return { ok: false, error: 'Invalid project spec', details: errors };

    const dir = ensureProjectsDirExists();
    const snap = projectManager.getIndex();
    if (snap.projectsById[sanitized.id]) {
      return { ok: false, error: `Project with id ${sanitized.id} already exists` };
    }

    const target = path.join(dir, `${sanitized.id}.json`);
    fs.writeFileSync(target, JSON.stringify(sanitized, null, 2), 'utf8');
    // watcher will pick up; but proactively rebuild to notify immediately
    await projectManager.rebuildAndNotify('Project created');
    return { ok: true };
  } catch (e) {
    console.error('projects:create failed', e);
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('projects:update', async (event, { id, spec }) => {
  try {
    const sanitized = { ...spec };
    if (!Array.isArray(sanitized.requirements)) sanitized.requirements = [];
    if (!sanitized.id) sanitized.id = id;
    const { valid, errors } = validateProjectSpec(sanitized);
    if (!valid) return { ok: false, error: 'Invalid project spec', details: errors };

    ensureProjectsDirExists();
    const snap = projectManager.getIndex();
    const existingPath = getProjectConfigPathForId(id);
    // If id changed, we will write to new file and delete old file if different
    const writePath = getProjectConfigPathForId(sanitized.id);

    fs.writeFileSync(writePath, JSON.stringify(sanitized, null, 2), 'utf8');
    if (fs.existsSync(existingPath) && path.resolve(existingPath) !== path.resolve(writePath)) {
      try { fs.unlinkSync(existingPath); } catch {}
    }

    await projectManager.rebuildAndNotify('Project updated');
    return { ok: true };
  } catch (e) {
    console.error('projects:update failed', e);
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('projects:delete', async (event, { id }) => {
  try {
    const p = getProjectConfigPathForId(id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    await projectManager.rebuildAndNotify('Project deleted');
    return { ok: true };
  } catch (e) {
    console.error('projects:delete failed', e);
    return { ok: false, error: String(e?.message || e) };
  }
});

// Chat
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

ipcMain.handle('chat:set-context', async (event, { projectId }) => {
  try {
    let targetDir;
    if (!projectId || projectId === 'main') {
      targetDir = chatManager.getDefaultChatsDir();
    } else {
      const snap = projectManager.getIndex();
      const spec = snap.projectsById?.[projectId];
      const projectsDirAbs = path.resolve(snap.projectsDir);
      if (spec) {
        const projectAbs = path.resolve(projectsDirAbs, spec.path);
        targetDir = path.join(projectAbs, 'chats');
      } else {
        targetDir = chatManager.getDefaultChatsDir();
      }
    }
    chatManager.setChatsDir(targetDir);
    return chatManager.listChats();
  } catch (e) {
    console.error('Failed to set chat context:', e);
    return chatManager.listChats();
  }
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
