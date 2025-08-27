import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import { validateProjectSpec } from './validator';

async function pathExists(p) { try { await fs.stat(p); return true } catch { return false } }

export class ProjectsIndexer {
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
    };
    this.watcher = null;
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
  }

  stopWatching() { if (this.watcher) { this.watcher.close(); this.watcher = null; } }

  async rebuildAndNotify(msg) {
    if (msg) console.log(msg);
    await this.buildIndex();
    if (this.window) {
      this.window.webContents.send('projects-index:update', this.getIndex());
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
          // Recurse only one level deep to avoid scanning unrelated repos
          // but still catch nested project configs inside subfolders
          await scan(abs);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
          await this._tryLoadProjectConfig(abs, projectsDirAbs, rootAbs, next);
        }
      }
    };

    if (await pathExists(projectsDirAbs)) {
      await scan(projectsDirAbs);
    } else {
      // Not an error; just no projects dir present
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
    if (!(resolved + path.sep).startsWith(normalizedProjects + path.sep) && resolved !== normalizedProjects) {
      next.errors.push({ type: 'security', file: configAbsPath, message: `Project path escapes projects directory: ${resolved}` });
      return;
    }

    const id = json.id;
    next.projectsById[id] = { ...json, path: path.relative(projectsDirAbs, resolved) };
  }
}
