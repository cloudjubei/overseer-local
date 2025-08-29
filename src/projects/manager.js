import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import { ipcMain } from 'electron';
import { validateProjectSpec } from './validator';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys"

async function pathExists(p) { try { await fs.stat(p); return true } catch { return false } }

export class ProjectManager {
  constructor(projectRoot, window) {
    this.projectRoot = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(projectRoot);
    this.projectsDir = path.join(this.projectRoot, 'projects');
    this.window = window;
    this.index = {
      root: this.projectRoot,
      projectsDir: this.projectsDir,
      updatedAt: null,
      projectsById: {},
      orderedIds: [],
      errors: [],
      metrics: { lastScanMs: 0, lastScanCount: 0 },
      // map project id -> config file path relative to projectsDir (for maintenance)
      configPathsById: {},
    };
    this.watcher = null;
    this._ipcBound = false;
  }

  getIndex() { return this.index; }

  async init() {
    await this.buildIndex();
    if (await pathExists(this.projectsDir)) {
      this.watcher = chokidar.watch(path.join(this.projectsDir, '**/*.json'), {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
      });
      this.watcher
        .on('add', (p) => this.rebuildAndNotify(`Project config added: ${p}`))
        .on('change', (p) => this.rebuildAndNotify(`Project config changed: ${p}`))
        .on('unlink', (p) => this.rebuildAndNotify(`Project config removed: ${p}`))
        .on('addDir', (p) => this.rebuildAndNotify(`Dir added: ${p}`))
        .on('unlinkDir', (p) => this.rebuildAndNotify(`Dir removed: ${p}`));
    }
    this._registerIpcHandlers();
  }

  stopWatching() { if (this.watcher) { this.watcher.close(); this.watcher = null; } }

  async rebuildAndNotify(msg) {
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
      orderedIds: [],
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

    // Stable ordering by title then id
    const projects = Object.values(next.projectsById);
    projects.sort((a, b) => (a.title?.localeCompare(b.title || '') || a.id.localeCompare(b.id)));
    next.orderedIds = projects.map(p => p.id);

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
    // store config file relative to projectsDir for maintenance (update/delete)
    next.configPathsById[id] = path.relative(projectsDirAbs, configAbsPath);
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {  }
    handlers[IPC_HANDLER_KEYS.PROJECTS_LIST] = (args) => this.listProjects(args)
    handlers[IPC_HANDLER_KEYS.PROJECTS_GET] = (args) => this.getProject(args)
    handlers[IPC_HANDLER_KEYS.PROJECTS_CREATE] = (args) => this.createProject(args)
    handlers[IPC_HANDLER_KEYS.PROJECTS_UPDATE] = (args) => this.updateProject(args)
    handlers[IPC_HANDLER_KEYS.PROJECTS_DELETE] = (args) => this.deleteProject(args)

    for(const handler of Object.keys(handlers)){
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
    const dir = this.getIndex().projectsDir;
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {}
    return dir;
  }

  getProjectConfigPathForId({id}) {
    const snap = this.getIndex();
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
    const snap = this.getIndex();
    if (snap.projectsById[sanitized.id]) {
      return { ok: false, error: `Project with id ${sanitized.id} already exists` };
    }

    const target = path.join(dir, `${sanitized.id}.json`);
    await fs.writeFile(target, JSON.stringify(sanitized, null, 2), 'utf8');
    await this.rebuildAndNotify('Project created');
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

    await this.rebuildAndNotify('Project updated');
    return { ok: true };
  }

  async deleteProject({id}) {
    const p = this.getProjectConfigPathForId(id);
    if (await pathExists(p)) {
      await fs.unlink(p);
    }
    await this.rebuildAndNotify('Project deleted');
    return { ok: true };
  }
}
