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

function upperEnvPrefix(name) {
  return String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function loadRenderer(win, name, hash) {
  const PREFIX = upperEnvPrefix(name);
  const DEV_URL = process.env[`${PREFIX}_VITE_DEV_SERVER_URL`];
  const VITE_NAME = process.env[`${PREFIX}_VITE_NAME`];
  if (DEV_URL) {
    const url = hash ? `${DEV_URL}#${hash}` : DEV_URL;
    win.loadURL(url);
  } else {
    const filePath = path.join(__dirname, `../renderer/${VITE_NAME}/index.html`);
    if (hash) {
      win.loadFile(filePath, { hash });
    } else {
      win.loadFile(filePath);
    }
  }
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  loadRenderer(mainWindow, 'main_window');

  // Open the DevTools in development.
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

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

function slugifyIdFromTitle(title) {
  const base = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return base || 'feature';
}

function allocateFeatureId(existingIds, title) {
  const used = new Set(existingIds.filter(Boolean));
  let base = slugifyIdFromTitle(title);
  let candidate = base;
  let counter = 1;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }
  return candidate;
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

  if (!feature || typeof feature !== 'object') throw new Error('feature must be an object');
  const out = {};
  let incomingId = feature.id;
  if (incomingId != null) {
    if (typeof incomingId !== 'string' || !incomingId.trim()) throw new Error('feature.id must be a non-empty string if provided');
    out.id = incomingId.trim();
  } else {
    const existingIds = json.features.map(f => f && f.id).filter(Boolean);
    out.id = allocateFeatureId(existingIds, feature.title);
  }
  if (json.features.some(f => f && f.id === out.id)) throw new Error(`Feature id '${out.id}' already exists in task ${taskId}`);
  if (!STATUSES.has(feature.status)) throw new Error('feature.status must be one of +,~, -,?,=');
  out.status = feature.status;
  for (const k of ['title', 'description', 'plan']) {
    const v = feature[k];
    if (typeof v !== 'string') throw new Error(`feature.${k} must be string`);
    out[k] = v;
  }
  for (const k of ['context', 'acceptance']) {
    const v = feature[k];
    if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) throw new Error(`feature.${k} must be string[]`);
    out[k] = v.map(s => String(s).trim()).filter(s => s.length > 0);
  }
  if (feature.dependencies !== undefined) {
    const v = feature.dependencies;
    if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) throw new Error('feature.dependencies must be string[] if provided');
    const arr = v.map(s => String(s).trim()).filter(s => s.length > 0);
    if (arr.length > 0) out.dependencies = arr;
  }
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

function openFeatureCreateWindow(parentWindow, taskId) {
  const win = new BrowserWindow({
    width: 800,
    height: 700,
    modal: !!parentWindow,
    parent: parentWindow || null,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  loadRenderer(win, 'feature_create', `task/${taskId}`);
  return win;
}

function openTaskCreateWindow(parentWindow) {
  const win = new BrowserWindow({
    width: 700,
    height: 600,
    modal: !!parentWindow,
    parent: parentWindow || null,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  loadRenderer(win, 'task_create');
  return win;
}

app.whenReady().then(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  indexer = new TasksIndexer(projectRoot);
  await indexer.init();

  ipcMain.handle('tasks-index:get', () => {
    return indexer ? indexer.getIndex() : null;
  });

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

  ipcMain.handle('tasks-feature:update', async (_event, payload) => {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
      const { taskId, featureId, data } = payload;
      if (!Number.isInteger(taskId)) throw new Error('taskId must be integer');
      if (!featureId || typeof featureId !== 'string') throw new Error('featureId must be string');
      if (!data || typeof data !== 'object') throw new Error('data must be object');
      await updateFeatureInTaskFile(indexer.tasksDir, taskId, featureId, data);
      await indexer.buildIndex();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

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

  ipcMain.handle('feature-create:open', async (event, payload) => {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
      const { taskId } = payload;
      if (!Number.isInteger(taskId)) throw new Error('taskId must be integer');
      const parent = BrowserWindow.fromWebContents(event.sender);
      openFeatureCreateWindow(parent, taskId);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  ipcMain.handle('task-create:open', async (event) => {
    try {
      const parent = BrowserWindow.fromWebContents(event.sender);
      openTaskCreateWindow(parent);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  createWindow();

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
});

app.on('before-quit', () => {
  if (indexer) indexer.stopWatching();
});
