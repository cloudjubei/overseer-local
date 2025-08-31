import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import { ipcMain } from 'electron';
import { validateProjectSpec } from './validator';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys"

async function pathExists(p) { try { await fs.stat(p); return true } catch { return false } }

export class ProjectsManager {
  constructor(projectRoot, window) {
    this.projectRoot = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(projectRoot);
    this.projectsDir = path.join(this.projectRoot, 'projects');
    this.window = window;
    
    console.log("ProjectsManager this.projectRoot: ", this.projectRoot, " this.projectsDir : ", this.projectsDir )
    this.index = {
      projectsById: {},
      errors: [],
      metrics: { lastScanMs: 0, lastScanCount: 0 },
      configPathsById: {},
      updatedAt: null,
    };

    this.watcher = null;
    this._ipcBound = false;
  }

  async init() {
    await this.buildIndex();
    if (await pathExists(this.projectsDir)) {
      this.watcher = chokidar.watch(path.join(this.projectsDir, '**/*.json'), {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
      });
      this.watcher
        .on('add', (p) => this.__rebuildAndNotify(`Project config added: ${p}`))
        .on('change', (p) => this.__rebuildAndNotify(`Project config changed: ${p}`))
        .on('unlink', (p) => this.__rebuildAndNotify(`Project config removed: ${p}`))
        .on('addDir', (p) => this.__rebuildAndNotify(`Dir added: ${p}`))
        .on('unlinkDir', (p) => this.__rebuildAndNotify(`Dir removed: ${p}`));
    }
    this._registerIpcHandlers();
  }

  stopWatching() { if (this.watcher) { this.watcher.close(); this.watcher = null; } }

  async __rebuildAndNotify(msg) {
    if (msg) console.log(msg);
    await this.buildIndex();
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE);
    }
  }

  async buildIndex() {
    const start = Date.now();
    const next = {
      ...this.index,
      updatedAt: new Date().toISOString(),
      projectsById: {},
      errors: [],
      configPathsById: {},
    };

    const projectsDirAbs = path.resolve(this.projectsDir);
    const rootAbs = path.resolve(this.projectRoot);

    const scan = async (dir) => {
      let entries = [];
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch (e) {
        if (e && e.code !== 'ENOENT') next.errors.push({ type: 'readdir', dir, message: e.message || String(e) });
        return;
      }
      for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scan(abs);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
          await this._tryLoadProjectConfig(abs, projectsDirAbs, rootAbs, next);
        }
      }
    };

    if (await pathExists(projectsDirAbs)) {
      await scan(projectsDirAbs);
    }

    this.index = next;
    this.index.metrics.lastScanMs = Date.now() - start;
    this.index.metrics.lastScanCount = next.orderedIds.length;
  }

  async _tryLoadProjectConfig(configAbsPath, projectsDirAbs, rootAbs, next) {
    let raw;
    try {
      raw = await fs.readFile(configAbsPath, 'utf8');
    } catch (e) {
      next.errors.push({ type: 'read', file: configAbsPath, message: e.message || String(e) });
      return;
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      next.errors.push({ type: 'parse', file: configAbsPath, message: e.message || String(e) });
      return;
    }

    const { valid, errors } = validateProjectSpec(json);
    if (!valid) {
      next.errors.push({ type: 'validate', file: configAbsPath, errors });
      return;
    }

    // Normalize and security-check path field to stay within projects directory
    const declaredPath = json.path;
    const resolved = path.isAbsolute(declaredPath)
      ? path.resolve(declaredPath)
      : path.resolve(projectsDirAbs, declaredPath);

    const normalizedProjects = projectsDirAbs;
    // if (!(resolved + path.sep).startsWith(normalizedProjects + path.sep) && resolved !== normalizedProjects) {
    //   next.errors.push({ type: 'security', file: configAbsPath, message: `Project path escapes projects directory: ${resolved}` });
    //   return;
    // }

    const id = json.id;
    next.projectsById[id] = { ...json, path: path.relative(projectsDirAbs, resolved) };
    next.configPathsById[id] = path.relative(projectsDirAbs, configAbsPath);
  }

  _registerIpcHandlers() {
      console.log("_registerIpcHandlers")
    if (this._ipcBound) return;

    const handlers = {  }
    handlers[IPC_HANDLER_KEYS.PROJECTS_LIST] = (args) => this.listProjects(args)
    handlers[IPC_HANDLER_KEYS.PROJECTS_GET] = (args) => this.getProject(args)
    handlers[IPC_HANDLER_KEYS.PROJECTS_CREATE] = (args) => this.createProject(args)
    handlers[IPC_HANDLER_KEYS.PROJECTS_UPDATE] = (args) => this.updateProject(args)
    handlers[IPC_HANDLER_KEYS.PROJECTS_DELETE] = (args) => this.deleteProject(args)
    handlers[IPC_HANDLER_KEYS.PROJECTS_TASK_REORDER] = async (args) => this.reorderTask(payload)

    for(const handler of Object.keys(handlers)){
      console.log("REGISTERING HANDLER: ", handler)
      ipcMain.handle(handler, async (event, args) => {
        try {
          return await handlers[handler](args)
        } catch (e) {
          console.error(`${handler} failed`, e);
          return { ok: false, error: String(e?.message || e) };
        }
      });
    }

    this._ipcBound = true;
  }

  async ensureProjectsDirExists() {
    const dir = this.index.projectsDir;
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {}
    return dir;
  }

  getProjectConfigPathForId({id}) {
    const snap = this.index;
    const rel = snap.configPathsById?.[id];
    if (rel) return path.join(snap.projectsDir, rel);
    return path.join(snap.projectsDir, `${id}.json`);
  }

  async listProjects() {
    return Object.values(this.index.projectsById)
  }
  
  async getProject({id}) {
    return this.index.projectsById[id]
  }

  async createProject({spec}) {
    const sanitized = { ...spec };
    if (!Array.isArray(sanitized.requirements)) sanitized.requirements = [];
    const { valid, errors } = validateProjectSpec(sanitized);
    if (!valid) return { ok: false, error: 'Invalid project spec', details: errors };

    const dir = await this.ensureProjectsDirExists();
    const snap = this.index;
    if (snap.projectsById[sanitized.id]) {
      return { ok: false, error: `Project with id ${sanitized.id} already exists` };
    }

    const target = path.join(dir, `${sanitized.id}.json`);
    await fs.writeFile(target, JSON.stringify(sanitized, null, 2), 'utf8');
    await this.__rebuildAndNotify('Project created');
    return { ok: true };
  }

  async updateProject({id, spec}) {
    const sanitized = { ...spec };
    if (!Array.isArray(sanitized.requirements)) sanitized.requirements = [];
    if (!sanitized.id) sanitized.id = id;
    const { valid, errors } = validateProjectSpec(sanitized);
    if (!valid) return { ok: false, error: 'Invalid project spec', details: errors };

    await this.ensureProjectsDirExists();
    const existingPath = this.getProjectConfigPathForId(id);
    const writePath = this.getProjectConfigPathForId(sanitized.id);

    await fs.writeFile(writePath, JSON.stringify(sanitized, null, 2), 'utf8');
    if (await pathExists(existingPath) && path.resolve(existingPath) !== path.resolve(writePath)) {
      try { await fs.unlink(existingPath); } catch {}
    }

    await this.__rebuildAndNotify('Project updated');
  }

  async deleteProject({id}) {
    const p = this.getProjectConfigPathForId(id);
    if (await pathExists(p)) {
      await fs.unlink(p);
    }
    await this.__rebuildAndNotify('Project deleted');
  }

  async reorderTask({project, fromIndex, toIndex}){ //TODO:
          const tasksDirAbs = path.resolve(this.tasksDir);
          const taskDirs = await fs.readdir(tasksDirAbs, { withFileTypes: true });
          let currentOrder = taskDirs
              .filter(d => d.isDirectory() && isNumericDir(d.name))
              .map(d => parseInt(d.name, 10))
              .sort((a, b) => a - b);
  
          let newOrder;
          if (payload.order) {
              newOrder = payload.order;
              const orderSet = new Set(newOrder);
              if (orderSet.size !== currentOrder.length || !newOrder.every(id => currentOrder.includes(id))) {
                  throw new Error('Invalid order: must include all existing task IDs without duplicates');
              }
          } else if (payload.fromId && payload.toIndex !== undefined) {
              const fromIndex = currentOrder.indexOf(payload.fromId);
              if (fromIndex === -1) throw new Error(`Task ${payload.fromId} not found`);
              if (payload.toIndex < 0 || payload.toIndex > currentOrder.length) throw new Error('Invalid target index');
              newOrder = [...currentOrder];
              const [moved] = newOrder.splice(fromIndex, 1);
              if (payload.toIndex >= newOrder.length) newOrder.push(moved)
              else newOrder.splice(payload.toIndex, 0, moved);
          } else {
              throw new Error('Invalid payload for reorder');
          }
  
          if (JSON.stringify(newOrder) === JSON.stringify(currentOrder)) {
              return { ok: true };
          }
  
          const newIdForOld = new Map();
          newOrder.forEach((oldId, index) => {
              newIdForOld.set(oldId, index + 1);
          });
  
          const featureIdUpdateMap = new Map();
          const tasksData = {};
          for (const oldId of currentOrder) {
              const taskPath = path.join(tasksDirAbs, String(oldId), 'task.json');
              const raw = await fs.readFile(taskPath, 'utf-8');
              tasksData[oldId] = JSON.parse(raw);
          }
  
          Object.entries(tasksData).forEach(([oldTaskIdStr, task]) => {
              const oldTaskId = parseInt(oldTaskIdStr);
              const newTaskId = newIdForOld.get(oldTaskId);
              task.id = newTaskId;
              task.features.forEach((feature, index) => {
                  const oldFeatureId = feature.id;
                  const newFeatureId = `${newTaskId}.${index + 1}`;
                  featureIdUpdateMap.set(oldFeatureId, newFeatureId);
                  feature.id = newFeatureId;
              });
          });
  
          Object.values(tasksData).forEach(task => {
              task.features.forEach(feature => {
                  if (feature.dependencies) {
                      feature.dependencies = feature.dependencies.map(dep => featureIdUpdateMap.get(dep) || dep);
                  }
              });
          });
  
          const stagingDir = path.join(tasksDirAbs, `.reorder_tmp_${Date.now()}`)
          await fs.mkdir(stagingDir, { recursive: true })
  
          for (const oldId of currentOrder) {
              const oldDir = path.join(tasksDirAbs, String(oldId));
              const stagedDir = path.join(stagingDir, String(oldId));
              if (!(await pathExists(oldDir))) {
                  throw new Error(`Source task directory not found: ${oldDir}`)
              }
              await fs.rename(oldDir, stagedDir);
          }
  
          for (const [newIndex, oldId] of newOrder.entries()) {
              const newId = newIndex + 1;
              const stagedDir = path.join(stagingDir, String(oldId));
              const newDir = path.join(tasksDirAbs, String(newId));
              await fs.rename(stagedDir, newDir);
              const newTaskPath = path.join(newDir, 'task.json');
              await fs.writeFile(newTaskPath, JSON.stringify(tasksData[oldId], null, 2), 'utf-8');
          }
  
          try { await fs.rmdir(stagingDir) } catch { /* ignore */ }
  
          await this.rebuildAndNotify('Tasks reordered, index rebuilt.');
          return { ok: true };
      }
}
