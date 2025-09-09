import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import { ipcMain } from 'electron';
import { validateProjectSpec } from './ProjectsValidator';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys"

async function pathExists(p) { try { await fs.stat(p); return true } catch { return false } }

export class ProjectsManager {
  constructor(projectRoot, window) {
    this.projectRoot = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(projectRoot);
    this.projectsDir = path.join(this.projectRoot, 'projects');
    this.window = window;
    this.watcher = null;
    this._ipcBound = false;

    this.projects = []
  }

  async init() {
    await this.__buildIndex();
    if (await pathExists(this.projectsDir)) {
      this.watcher = chokidar.watch(path.join(this.projectsDir, '/*.json'), {
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

  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  __notify(msg) {
    if (msg) console.log(msg);
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, this.projects);
    }
  }
  async __rebuildAndNotify(msg) {
    await this.__buildIndex();
    this.__notify(msg)
  }

  async __buildIndex() {
    const projectsDirAbs = path.resolve(this.projectsDir);
    const rootAbs = path.resolve(this.projectRoot);

    const projects = []

    if (await pathExists(projectsDirAbs)) {
      let entries = [];
      try { entries = await fs.readdir(projectsDirAbs, { withFileTypes: true }); } catch (e) {
        if (e && e.code !== 'ENOENT') next.errors.push({ type: 'readdir', dir, message: e.message || String(e) });
        return;
      }
      for (const entry of entries) {
        const abs = path.join(projectsDirAbs, entry.name);
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
          const project = await this._tryLoadProjectConfig(abs, projectsDirAbs, rootAbs);
          if (project){
            projects.push(project)
          }
        }
      }
    }
    
    this.projects = projects
  }

  async _tryLoadProjectConfig(configAbsPath, projectsDirAbs, rootAbs) {
    let raw;
    try {
      raw = await fs.readFile(configAbsPath, 'utf8');
    } catch (e) {
      return;
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      return;
    }

    const { valid, errors } = validateProjectSpec(json);
    if (!valid) {
      return;
    }

    // Normalize and security-check path field to stay within projects directory
    // const declaredPath = json.path;
    // const resolved = path.isAbsolute(declaredPath)
    //   ? path.resolve(declaredPath)
    //   : path.resolve(projectsDirAbs, declaredPath);

    // const normalizedProjects = projectsDirAbs;
    // if (!(resolved + path.sep).startsWith(normalizedProjects + path.sep) && resolved !== normalizedProjects) {
    //   next.errors.push({ type: 'security', file: configAbsPath, message: `Project path escapes projects directory: ${resolved}` });
    //   return;
    // }

    return json
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {  }
    handlers[IPC_HANDLER_KEYS.PROJECTS_LIST] = () => this.listProjects()
    handlers[IPC_HANDLER_KEYS.PROJECTS_GET] = (args) => this.getProject(args.id)
    handlers[IPC_HANDLER_KEYS.PROJECTS_CREATE] = (args) => this.createProject(args.project)
    handlers[IPC_HANDLER_KEYS.PROJECTS_UPDATE] = (args) => this.updateProject(args.id, args.project)
    handlers[IPC_HANDLER_KEYS.PROJECTS_DELETE] = (args) => this.deleteProject(args.id)
    handlers[IPC_HANDLER_KEYS.PROJECTS_TASK_REORDER] = async (args) => this.reorderTask(args.projectId, args.fromIndex, args.toIndex)

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
    const dir = this.projectsDir;
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {}
    return dir;
  }

  getProjectConfigPathForId(id) {
    return path.join(this.projectsDir, `${id}.json`);
  }

  async listProjects() {
    return this.projects
  }
  
  async getProject(id) {
    return this.projects.find(p => p.id === id)
  }

  async createProject(spec) {
    const sanitized = { ...spec };
    if (!Array.isArray(sanitized.requirements)) sanitized.requirements = [];
    const { valid, errors } = validateProjectSpec(sanitized);
    if (!valid) return { ok: false, error: 'Invalid project spec', details: errors };

    const dir = await this.ensureProjectsDirExists();

    const project = this.getProject(sanitized.id)
    if (project) {
      return project
    }

    const target = path.join(dir, `${sanitized.id}.json`);
    await fs.writeFile(target, JSON.stringify(sanitized, null, 2), 'utf8');

    this.projects.push(sanitized)
    await this.__notify('Project created')
    return sanitized
  }

  async updateProject(id, spec) {
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

    this.projects = this.projects.map(p => p.id === sanitized.id ? sanitized : p)
    await this.__notify('Project updated');
    return sanitized
  }

  async deleteProject(id) {
    const p = this.getProjectConfigPathForId(id);
    if (await pathExists(p)) {
      await fs.unlink(p);
      this.projects = this.projects.filter(p => p.id !== id)
      await this.__notify('Project deleted');
    }
  }

  async reorderTask(projectId, fromIndex, toIndex)
  {
    const project = await this.getProject(projectId)
    if (!project){ throw new Error(`Project with id: ${projectId} not found`)}
  
    const currentOrder = Object.keys(project.taskIdToDisplayIndex).sort((a, b) => project.taskIdToDisplayIndex[a] - project.taskIdToDisplayIndex[b]);
  
    let newOrder;
    if (fromIndex !== undefined && toIndex !== undefined) {
      if (fromIndex < 0 || fromIndex >= currentOrder.length) throw new Error('Invalid source index');
      if (toIndex < 0 || toIndex > currentOrder.length) throw new Error('Invalid target index');
      newOrder = [...currentOrder];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
    } else {
      throw new Error('Invalid indices for reorder');
    }

    if (JSON.stringify(newOrder) === JSON.stringify(currentOrder)) {
      return { ok: true };
    }
  
    const newIndex = {};
    newOrder.forEach((id, i) => {
      newIndex[id] = i + 1;
    });
    project.taskIdToDisplayIndex = newIndex;
  
    const writePath = this.getProjectConfigPathForId(projectId);
    await fs.writeFile(writePath, JSON.stringify(project, null, 2), 'utf8');

    this.projects = this.projects.map(p => p.id === project.id ? project : p)

    await this.__notify('Task reordered');
    return { ok: true };
  }
}
