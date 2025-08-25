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

function loadRenderer(win, name, hash) {
  // In dev mode, all renderers are served by the same vite dev server,
  // which is configured under the 'main_window' renderer name in forge.config.js
  const DEV_URL = process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL;
  const RENDERER_NAME = process.env.MAIN_WINDOW_VITE_NAME;

  const htmlFileMap = {
    'main_window': 'index.html',
    'task_create': 'task_create.html',
    'feature_create': 'feature_create.html',
  };
  const htmlFile = htmlFileMap[name];
  if (!htmlFile) {
    throw new Error(`No HTML file mapping for renderer: ${name}`);
  }

  if (DEV_URL) {
    const url = new URL(htmlFile, DEV_URL);
    if (hash) {
      url.hash = hash;
    }
    win.loadURL(url.toString());
  } else {
    // In production, files are built into a subdirectory of the renderer output dir
    // that matches the renderer's name.
    if (!RENDERER_NAME) {
      throw new Error('Fatal: MAIN_WINDOW_VITE_NAME environment variable is not set.');
    }
    const filePath = path.join(__dirname, `../renderer/${RENDERER_NAME}/${htmlFile}`);
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

function allocateFeatureId(existingIds, title, taskId) {
  // Prefer numeric dotted scheme if existing IDs follow it
  const dotted = existingIds.every(id => typeof id === 'string' && /^\d+\.\d+$/.test(id));
  if (dotted && Number.isInteger(taskId)) {
    // Determine next index
    let maxN = 0;
    for (const id of existingIds) {
      const m = String(id).match(/\.(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isInteger(n) && n > maxN) maxN = n;
      }
    }
    return `${taskId}.${maxN + 1}`;
  }
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
    out.id = allocateFeatureId(existingIds, feature.title, taskId);
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

function buildReorderedIds(taskId, features) {
  // Assign sequential dotted IDs like `${taskId}.1`, `${taskId}.2`, ...
  return features.map((_, idx) => `${taskId}.${idx + 1}`);
}

async function reorderFeaturesInTaskFile(tasksDir, taskId, payload) {
  // payload: either { order: string[] } or { fromId: string, toIndex: number }
  const dir = path.join(tasksDir, String(taskId));
  const file = path.join(dir, 'task.json');

  let json;
  try {
    const data = await fsp.readFile(file, 'utf8');
    json = JSON.parse(data);
  } catch (e) {
    throw new Error(`Failed to read task file: ${e.message || String(e)}`);
  }

  if (!Array.isArray(json.features)) throw new Error('Task has no features array');

  const currentIds = json.features.map(f => f && f.id).filter(Boolean);
  if (currentIds.length !== json.features.length) throw new Error('All features must have ids');

  let newOrderIds = null;
  if (payload && Array.isArray(payload.order)) {
    newOrderIds = payload.order.slice();
  } else if (payload && typeof payload.fromId === 'string' && Number.isInteger(payload.toIndex)) {
    // construct order by moving one id
    const arr = currentIds.slice();
    const fromIdx = arr.indexOf(payload.fromId);
    if (fromIdx === -1) throw new Error('fromId not found');
    const toIndex = Math.max(0, Math.min(arr.length - 1, payload.toIndex));
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIndex, 0, moved);
    newOrderIds = arr;
  } else {
    throw new Error('Invalid reorder payload');
  }

  // Validate it's a permutation of current ids
  if (newOrderIds.length !== currentIds.length) throw new Error('order length mismatch');
  const setA = new Set(currentIds);
  const setB = new Set(newOrderIds);
  if (setA.size !== setB.size || [...setA].some(id => !setB.has(id))) {
    throw new Error('order must be a permutation of current feature ids');
  }

  // Build the new ordered features array
  const byId = new Map(json.features.map(f => [f.id, f]));
  const newFeatures = newOrderIds.map(id => byId.get(id));

  // Compute new IDs and mapping old->new
  const newIds = buildReorderedIds(taskId, newFeatures);
  const idMapping = new Map();
  newOrderIds.forEach((oldId, idx) => {
    idMapping.set(oldId, newIds[idx]);
  });

  // Apply new IDs to features
  const renamedFeatures = newFeatures.map((f, idx) => ({ ...f, id: newIds[idx] }));

  // Update dependencies inside this task and across all tasks
  const updatedTaskFiles = new Set();

  // First, write back the main task with renamed ids and updated intra-task dependencies
  function remapDeps(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.map(d => (idMapping.has(d) ? idMapping.get(d) : d));
  }

  const rewrittenTask = { ...json, features: renamedFeatures.map(feat => ({
    ...feat,
    dependencies: remapDeps(feat.dependencies)
  })) };

  // Validate and write main task file
  {
    const [ok, errors] = validateTask(rewrittenTask);
    if (!ok) throw new Error(`Validation failed after reorder: ${errors.join('; ')}`);
    const pretty = JSON.stringify(rewrittenTask, null, 2) + '\n';
    await fsp.writeFile(file, pretty, 'utf8');
    updatedTaskFiles.add(String(taskId));
  }

  // Now scan all other tasks to update dependencies
  const taskDirs = (await fsp.readdir(tasksDir, { withFileTypes: true }).catch(() => []))
    .filter(e => e.isDirectory() && /^\d+$/.test(e.name))
    .map(e => e.name);

  for (const tid of taskDirs) {
    const tfile = path.join(tasksDir, tid, 'task.json');
    let tjson;
    try {
      const data = await fsp.readFile(tfile, 'utf8');
      tjson = JSON.parse(data);
    } catch (_) {
      continue;
    }
    if (!tjson || !Array.isArray(tjson.features)) continue;

    let changed = false;
    for (let i = 0; i < tjson.features.length; i++) {
      const f = tjson.features[i];
      if (Array.isArray(f.dependencies) && f.dependencies.length > 0) {
        const nextDeps = f.dependencies.map(d => (idMapping.has(d) ? idMapping.get(d) : d));
        const same = nextDeps.length === f.dependencies.length && nextDeps.every((d, idx) => d === f.dependencies[idx]);
        if (!same) {
          tjson.features[i] = { ...f, dependencies: nextDeps };
          changed = true;
        }
      }
    }

    if (changed) {
      const [ok, errors] = validateTask(tjson);
      if (!ok) throw new Error(`Validation failed updating dependencies in task ${tid}: ${errors.join('; ')}`);
      const pretty = JSON.stringify(tjson, null, 2) + '\n';
      await fsp.writeFile(tfile, pretty, 'utf8');
      updatedTaskFiles.add(String(tid));
    }
  }

  return { ok: true, updated: Array.from(updatedTaskFiles) };
}

// Reorder tasks: renumber task ids to match the new ordering and update all references
async function reorderTasksInDir(tasksDir, payload) {
  // Gather current task ids (numeric asc)
  const entries = await fsp.readdir(tasksDir, { withFileTypes: true }).catch(() => []);
  const currentIds = entries
    .filter(e => e.isDirectory() && /^\d+$/.test(e.name))
    .map(e => parseInt(e.name, 10))
    .filter(n => Number.isInteger(n))
    .sort((a, b) => a - b);

  if (currentIds.length === 0) return { ok: true, updated: [] };

  let newOrder = null;
  if (payload && Array.isArray(payload.order)) {
    const coerced = payload.order.map(x => parseInt(x, 10));
    newOrder = coerced;
  } else if (payload && Number.isInteger(payload.fromId) && Number.isInteger(payload.toIndex)) {
    const arr = currentIds.slice();
    const fromIdx = arr.indexOf(payload.fromId);
    if (fromIdx === -1) throw new Error('fromId not found');
    const toIndex = Math.max(0, Math.min(arr.length - 1, payload.toIndex));
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIndex, 0, moved);
    newOrder = arr;
  } else {
    throw new Error('Invalid reorder payload');
  }

  // Validate permutation
  if (newOrder.length !== currentIds.length) throw new Error('order length mismatch');
  const setA = new Set(currentIds);
  const setB = new Set(newOrder);
  if (setA.size !== setB.size || [...setA].some(id => !setB.has(id))) {
    throw new Error('order must be a permutation of current task ids');
  }

  // Compute mapping oldId -> newId (sequential renumber 1..N according to new order)
  const mapping = new Map();
  newOrder.forEach((oldId, idx) => {
    mapping.set(oldId, idx + 1);
  });

  // Early exit if identity mapping
  const identity = currentIds.every(id => mapping.get(id) === id);
  if (identity) return { ok: true, updated: [] };

  // Read all task.json into memory; build global feature id mapping for tasks whose id changes
  const tasks = [];
  const globalFeatIdMap = new Map(); // old dotted id -> new dotted id

  for (const oldId of currentIds) {
    const dir = path.join(tasksDir, String(oldId));
    const file = path.join(dir, 'task.json');
    let json;
    try {
      const data = await fsp.readFile(file, 'utf8');
      json = JSON.parse(data);
    } catch (e) {
      throw new Error(`Failed to read task ${oldId}: ${e.message || String(e)}`);
    }
    const newId = mapping.get(oldId);
    tasks.push({ oldId, newId, dir, file, json });

    if (newId !== oldId && Array.isArray(json.features)) {
      for (const f of json.features) {
        const m = f && typeof f.id === 'string' ? f.id.match(/^(\d+)\.(\d+)$/) : null;
        if (m && parseInt(m[1], 10) === oldId) {
          const suffix = parseInt(m[2], 10);
          if (Number.isInteger(suffix)) {
            globalFeatIdMap.set(f.id, `${newId}.${suffix}`);
          }
        }
      }
    }
  }

  // Rewrite task files in place with updated ids and dependencies
  const updatedTaskFiles = new Set();

  for (const t of tasks) {
    const { oldId, newId, file, json } = t;
    let changed = false;

    // Update task.id if needed
    if (newId !== oldId) {
      json.id = newId;
      changed = true;
    }

    // Update feature ids if dotted with old prefix
    if (Array.isArray(json.features)) {
      for (let i = 0; i < json.features.length; i++) {
        const f = json.features[i];
        if (!f || typeof f.id !== 'string') continue;
        const m = f.id.match(/^(\d+)\.(\d+)$/);
        if (m && parseInt(m[1], 10) === oldId && newId !== oldId) {
          const suffix = parseInt(m[2], 10);
          const newFid = `${newId}.${suffix}`;
          if (newFid !== f.id) {
            json.features[i] = { ...f, id: newFid };
            changed = true;
          }
        }
      }
    }

    // Update dependencies via global feature id map
    if (Array.isArray(json.features)) {
      for (let i = 0; i < json.features.length; i++) {
        const f = json.features[i];
        if (Array.isArray(f.dependencies) && f.dependencies.length > 0) {
          const nextDeps = f.dependencies.map(d => (globalFeatIdMap.has(d) ? globalFeatIdMap.get(d) : d));
          const same = nextDeps.length === f.dependencies.length && nextDeps.every((d, idx) => d === f.dependencies[idx]);
          if (!same) {
            json.features[i] = { ...json.features[i], dependencies: nextDeps };
            changed = true;
          }
        }
      }
    }

    if (changed) {
      const [ok, errors] = validateTask(json);
      if (!ok) throw new Error(`Validation failed updating task ${oldId}: ${errors.join('; ')}`);
      const pretty = JSON.stringify(json, null, 2) + '\n';
      await fsp.writeFile(file, pretty, 'utf8');
      updatedTaskFiles.add(String(oldId));
    }
  }

  // Perform directory renames using temp names to avoid conflicts
  const renames = [];
  const timestamp = Date.now();
  for (const t of tasks) {
    if (t.newId === t.oldId) continue;
    const tmpName = `__tmp__${t.oldId}__${timestamp}_${Math.random().toString(36).slice(2,8)}`;
    const tmpPath = path.join(tasksDir, tmpName);
    await fsp.rename(t.dir, tmpPath);
    renames.push({ tmpPath, finalPath: path.join(tasksDir, String(t.newId)) });
  }
  for (const r of renames) {
    await fsp.rename(r.tmpPath, r.finalPath);
  }

  // After renames, return list of updated tasks (by old ids written) and all moved tasks (by new ids)
  const moved = tasks.filter(t => t.newId !== t.oldId).map(t => String(t.newId));
  return { ok: true, updated: Array.from(new Set([ ...Array.from(updatedTaskFiles), ...moved ])) };
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

  ipcMain.handle('tasks-features:reorder', async (_event, payload) => {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
      const { taskId } = payload;
      if (!Number.isInteger(taskId)) throw new Error('taskId must be integer');
      const res = await reorderFeaturesInTaskFile(indexer.tasksDir, taskId, payload);
      await indexer.buildIndex();
      return { ok: true, updated: res.updated };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  // New: reorder tasks (renumber ids and update references)
  ipcMain.handle('tasks:reorder', async (_event, payload) => {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
      const res = await reorderTasksInDir(indexer.tasksDir, payload);
      await indexer.buildIndex();
      return { ok: true, updated: res.updated };
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
