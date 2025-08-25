const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fsp = require('node:fs/promises');
const fs = require('node:fs');
const { TasksIndexer, validateTask, STATUSES } = require('./tasks/indexer');

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

async function ensureTasksDir(tasksDir) {
  try {
    await fsp.mkdir(tasksDir, { recursive: true });
  } catch (e) {
    // ignore if it exists; rethrow others
    if (e && e.code !== 'EEXIST') throw e;
  }
}

async function readExistingTaskIds(tasksDir) {
  try {
    const entries = await fsp.readdir(tasksDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
      .map((e) => parseInt(e.name, 10))
      .filter((n) => Number.isInteger(n));
  } catch (_) {
    return [];
  }
}

async function allocateTaskId(tasksDir, preferredId) {
  await ensureTasksDir(tasksDir);
  const used = new Set(await readExistingTaskIds(tasksDir));
  if (Number.isInteger(preferredId) && preferredId > 0 && !used.has(preferredId)) {
    return preferredId;
  }
  let max = 0;
  for (const n of used) if (n > max) max = n;
  let candidate = max + 1 || 1;
  while (used.has(candidate) || fs.existsSync(path.join(tasksDir, String(candidate)))) {
    candidate += 1;
  }
  return candidate;
}

async function updateTaskInTaskFile(tasksDir, taskId, patch) {
  const dir = path.join(tasksDir, String(taskId));
  const file = path.join(dir, 'task.json');
  let json;
  try {
    const data = await fsp.readFile(file, 'utf8');
    json = JSON.parse(data);
  } catch (e) {
    throw new Error(`Failed to read task file: ${e.message || String(e)}`);
  }

  if (!json || typeof json !== 'object') {
    throw new Error('Invalid task file content');
  }

  const allowed = ['title', 'description'];
  let touched = false;
  for (const k of allowed) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if (v != null && typeof v !== 'string') throw new Error(`${k} must be string`);
    json[k] = v == null ? '' : String(v);
    touched = true;
  }
  if (!touched) {
    throw new Error('No valid fields to update');
  }

  const [ok, errors] = validateTask(json);
  if (!ok) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  const pretty = JSON.stringify(json, null, 2) + '\n';
  try {
    await fsp.writeFile(file, pretty, 'utf8');
  } catch (e) {
    throw new Error(`Failed to write task file: ${e.message || String(e)}`);
  }
}

async function updateFeatureInTaskFile(tasksDir, taskId, featureId, patch) {
  const dir = path.join(tasksDir, String(taskId));
  const file = path.join(dir, 'task.json');
  let json;
  try {
    const data = await fsp.readFile(file, 'utf8');
    json = JSON.parse(data);
  } catch (e) {
    throw new Error(`Failed to read task file: ${e.message || String(e)}`);
  }

  if (!Array.isArray(json.features)) {
    throw new Error('Task has no features array');
  }

  const idx = json.features.findIndex(f => f && f.id === featureId);
  if (idx === -1) {
    throw new Error(`Feature ${featureId} not found in task ${taskId}`);
  }

  const current = json.features[idx] || {};

  // Sanitize patch
  const allowed = ['status', 'title', 'description', 'plan', 'context', 'acceptance', 'dependencies', 'rejection'];
  const next = { ...current };
  for (const k of allowed) {
    if (!(k in patch)) continue;
    const v = patch[k];
    switch (k) {
      case 'status':
        if (!STATUSES.has(v)) throw new Error('Invalid status value');
        next.status = v; break;
      case 'title':
      case 'description':
      case 'plan':
      case 'rejection':
        if (v != null && typeof v !== 'string') throw new Error(`${k} must be string`);
        if (v == null || v === '') {
          if (k === 'rejection') delete next.rejection; else next[k] = '';
        } else {
          next[k] = v;
        }
        break;
      case 'context':
      case 'acceptance':
      case 'dependencies':
        if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) throw new Error(`${k} must be string[]`);
        const arr = v.map(s => s.trim()).filter(s => s.length > 0);
        if (k === 'dependencies' && arr.length === 0) {
          delete next.dependencies;
        } else {
          next[k] = arr;
        }
        break;
      default:
        break;
    }
  }

  json.features[idx] = next;

  const [ok, errors] = validateTask(json);
  if (!ok) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  const pretty = JSON.stringify(json, null, 2) + '\n';
  try {
    await fsp.writeFile(file, pretty, 'utf8');
  } catch (e) {
    throw new Error(`Failed to write task file: ${e.message || String(e)}`);
  }
}

async function addFeatureToTaskFile(tasksDir, taskId, feature) {
  const dir = path.join(tasksDir, String(taskId));
  const file = path.join(dir, 'task.json');
  let json;
  try {
    const data = await fsp.readFile(file, 'utf8');
    json = JSON.parse(data);
  } catch (e) {
    throw new Error(`Failed to read task file: ${e.message || String(e)}`);
  }

  if (!json || typeof json !== 'object') {
    throw new Error('Invalid task file content');
  }

  if (!Array.isArray(json.features)) {
    json.features = [];
  }

  // Validate and sanitize incoming feature
  if (!feature || typeof feature !== 'object') throw new Error('feature must be an object');
  const out = {};
  // id
  if (typeof feature.id !== 'string' || !feature.id.trim()) throw new Error('feature.id must be a non-empty string');
  out.id = feature.id.trim();
  if (json.features.some(f => f && f.id === out.id)) throw new Error(`Feature id '${out.id}' already exists in task ${taskId}`);
  // status
  if (!STATUSES.has(feature.status)) throw new Error('feature.status must be one of +,~, -,?,=');
  out.status = feature.status;
  // title/description/plan
  for (const k of ['title', 'description', 'plan']) {
    const v = feature[k];
    if (typeof v !== 'string') throw new Error(`feature.${k} must be string`);
    out[k] = v;
  }
  // context/acceptance (required arrays)
  for (const k of ['context', 'acceptance']) {
    const v = feature[k];
    if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) throw new Error(`feature.${k} must be string[]`);
    out[k] = v.map(s => String(s).trim()).filter(s => s.length > 0);
  }
  // dependencies (optional)
  if (feature.dependencies !== undefined) {
    const v = feature.dependencies;
    if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) throw new Error('feature.dependencies must be string[] if provided');
    const arr = v.map(s => String(s).trim()).filter(s => s.length > 0);
    if (arr.length > 0) out.dependencies = arr;
  }
  // rejection (optional)
  if (feature.rejection !== undefined) {
    const v = feature.rejection;
    if (v != null && typeof v !== 'string') throw new Error('feature.rejection must be string if provided');
    const trimmed = String(v || '').trim();
    if (trimmed) out.rejection = trimmed;
  }

  json.features.push(out);

  const [ok, errors] = validateTask(json);
  if (!ok) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  const pretty = JSON.stringify(json, null, 2) + '\n';
  try {
    await fsp.writeFile(file, pretty, 'utf8');
  } catch (e) {
    throw new Error(`Failed to write task file: ${e.message || String(e)}`);
  }
}

async function addTaskFile(tasksDir, payload) {
  await ensureTasksDir(tasksDir);
  const chosenId = await allocateTaskId(tasksDir, payload && payload.id);
  const dir = path.join(tasksDir, String(chosenId));
  const file = path.join(dir, 'task.json');

  try { await fsp.mkdir(dir, { recursive: true }); } catch (e) { /* ignore */ }

  const title = payload && typeof payload.title === 'string' ? payload.title : '';
  const description = payload && typeof payload.description === 'string' ? payload.description : '';
  const status = payload && STATUSES.has(payload.status) ? payload.status : '-';

  const json = {
    id: chosenId,
    status,
    title,
    description,
    features: [],
  };

  const [ok, errors] = validateTask(json);
  if (!ok) throw new Error(`Validation failed: ${errors.join('; ')}`);

  const pretty = JSON.stringify(json, null, 2) + '\n';
  await fsp.writeFile(file, pretty, 'utf8');
  return json;
}

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

  // New: task update handler (title, description)
  ipcMain.handle('tasks:update', async (_event, payload) => {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
      const { taskId, data } = payload;
      if (!Number.isInteger(taskId)) throw new Error('taskId must be integer');
      if (!data || typeof data !== 'object') throw new Error('data must be object');
      await updateTaskInTaskFile(indexer.tasksDir, taskId, data);
      await indexer.buildIndex();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  // New: feature update handler
  ipcMain.handle('tasks-feature:update', async (_event, payload) => {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
      const { taskId, featureId, data } = payload;
      if (!Number.isInteger(taskId)) throw new Error('taskId must be integer');
      if (!featureId || typeof featureId !== 'string') throw new Error('featureId must be string');
      if (!data || typeof data !== 'object') throw new Error('data must be object');
      await updateFeatureInTaskFile(indexer.tasksDir, taskId, featureId, data);
      // Rebuild index immediately for responsive UI
      await indexer.buildIndex();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  // New: feature add handler
  ipcMain.handle('tasks-feature:add', async (_event, payload) => {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
      const { taskId, feature } = payload;
      if (!Number.isInteger(taskId)) throw new Error('taskId must be integer');
      if (!feature || typeof feature !== 'object') throw new Error('feature must be object');
      await addFeatureToTaskFile(indexer.tasksDir, taskId, feature);
      await indexer.buildIndex();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  // New: task add handler
  ipcMain.handle('tasks:add', async (_event, payload) => {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
      const created = await addTaskFile(indexer.tasksDir, payload);
      await indexer.buildIndex();
      return { ok: true, id: created.id };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
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
