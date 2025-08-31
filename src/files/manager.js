import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { ipcMain } from 'electron';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';

// Simple mime-like inference by extension
function inferTypeByExt(name) {
  const i = name.lastIndexOf('.');
  const ext = i >= 0 ? name.slice(i + 1).toLowerCase() : '';
  if (!ext) return undefined;
  if (['txt','md','mdx','log'].includes(ext)) return 'text/plain';
  if (['json','yml','yaml','xml','csv'].includes(ext)) return 'text/plain';
  if (['js','jsx','ts','tsx','css','scss','less','html','htm'].includes(ext)) return 'text/plain';
  if (['png'].includes(ext)) return 'image/png';
  if (['jpg','jpeg'].includes(ext)) return 'image/jpeg';
  if (['gif'].includes(ext)) return 'image/gif';
  if (['svg'].includes(ext)) return 'image/svg+xml';
  if (['pdf'].includes(ext)) return 'application/pdf';
  return undefined;
}

export class FilesManager { //TODO: index per project + ensure files are project scoped only
  constructor(projectRoot, window, options = {}) {
    this.projectRoot = projectRoot;
    this.filesDir = options.filesDir || projectRoot;
    this.window = window;
    this.options = options;

    this.index = {
      root: projectRoot,
      filesDir: this.filesDir,
      updatedAt: null,
      files: [],
      errors: [],
      metrics: { lastScanMs: 0, lastScanCount: 0 },
    };

    this.watcher = null;

    // Whether IPC handlers are bound (to avoid double-binding on re-init)
    this._ipcBound = false;
  }

  async init() {
    await this.buildIndex();
    await this._startWatcher();
    this._registerIpcHandlers();
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {}
    handlers[IPC_HANDLER_KEYS.FILES_LIST] = async (args) => this.listFiles(args)
    handlers[IPC_HANDLER_KEYS.FILES_READ] = async (args) => this.readFile(args)
    handlers[IPC_HANDLER_KEYS.FILES_READ_BINARY] = async (args) => this.readFileBinary(args)
    handlers[IPC_HANDLER_KEYS.FILES_READ_DIRECTORY] = async (args) => this.readDirectory(args)
    handlers[IPC_HANDLER_KEYS.FILES_WRITE] = async (args) => this.writeFile(args)
    handlers[IPC_HANDLER_KEYS.FILES_DELETE] = async (args) => this.deleteFile(args)
    handlers[IPC_HANDLER_KEYS.FILES_RENAME] = async (args) => this.renameFile(args)
    handlers[IPC_HANDLER_KEYS.FILES_UPLOAD] = async (args) => this.uploadFile(args)

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

  async _startWatcher() {
    if (this.watcher) {
      try { await this.watcher.close(); } catch {}
      this.watcher = null;
    }

    const ignored = [
      /(^|[\/\\])\../, // dotfiles/folders
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/build/**',
      '**/.git/**',
      '**/.cache/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.vite/**',
      '**/tmp/**',
    ];

    this.watcher = chokidar.watch(path.join(this.filesDir, '**/*'), {
      ignored,
      persistent: true,
      ignoreInitial: true,
    });

    const onChange = async (msg) => {
      if (msg) console.log(msg);
      await this.buildIndex();
      if (this.window) {
        this.window.webContents.send(IPC_HANDLER_KEYS.FILES_SUBSCRIBE);
      }
    };

    this.watcher
      .on('add', (p) => onChange(`File added: ${p}`))
      .on('change', (p) => onChange(`File changed: ${p}`))
      .on('unlink', (p) => onChange(`File removed: ${p}`))
      .on('addDir', (p) => onChange(`Dir added: ${p}`))
      .on('unlinkDir', (p) => onChange(`Dir removed: ${p}`));
  }

  async setFilesDir(nextDir) {
    const normalizedNext = path.resolve(nextDir);
    const normalizedCurrent = path.resolve(this.filesDir);
    if (normalizedNext === normalizedCurrent) {
      return this.getIndex();
    }
    this.stopWatching();
    this.filesDir = normalizedNext;
    this.index.filesDir = this.filesDir;
    await this.__rebuildAndNotify();
    await this._startWatcher();
  }
  
  async __rebuildAndNotify(logMessage) {
    if (logMessage) console.log(logMessage);
    await this.buildIndex();
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, this.getIndex());
    }
  }

  async buildIndex() {
    const start = Date.now();
    const newIndex = {
      ...this.index,
      filesDir: this.filesDir,
      updatedAt: new Date().toISOString(),
      files: [],
      errors: [],
    };

    try {
      const s = await fs.stat(this.filesDir);
      if (!s.isDirectory()) throw new Error('filesDir is not a directory');
    } catch (e) {
      newIndex.errors.push({ type: 'stat', dir: this.filesDir, message: e.message || String(e) });
      this.index = newIndex;
      this.index.metrics.lastScanMs = Date.now() - start;
      this.index.metrics.lastScanCount = 0;
      return;
    }

    await this._walkAndIndex('', newIndex.files, newIndex.errors);

    // stable sort
    newIndex.files.sort((a, b) => a.path.localeCompare(b.path));

    this.index = newIndex;
    this.index.metrics.lastScanMs = Date.now() - start;
    this.index.metrics.lastScanCount = this.index.files.length;
  }

  async _walkAndIndex(relDir, filesAcc, errorsAcc) {
    const absDir = path.join(this.filesDir, relDir);
    let entries;
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch (e) {
      if (e && e.code === 'ENOENT') return;
      errorsAcc.push({ type: 'readdir', dir: absDir, message: e.message || String(e) });
      return;
    }

    for (const entry of entries) {
      const entryRel = relDir ? path.join(relDir, entry.name) : entry.name;
      const entryAbs = path.join(this.filesDir, entryRel);

      // Skip ignored folders similar to watcher
      if (entry.isDirectory()) {
        if (/^(node_modules|dist|out|build|\.git|\.cache|coverage|\.next|\.vite|tmp)$/i.test(entry.name)) {
          continue;
        }
        await this._walkAndIndex(entryRel, filesAcc, errorsAcc);
      } else if (entry.isFile()) {
        let stats;
        try {
          stats = await fs.stat(entryAbs);
        } catch (e) {
          errorsAcc.push({ type: 'stat', file: entryAbs, message: e.message || String(e) });
          continue;
        }
        const name = path.basename(entryRel);
        const i = name.lastIndexOf('.');
        const ext = i >= 0 ? name.slice(i + 1).toLowerCase() : undefined;
        const type = inferTypeByExt(name);
        filesAcc.push({
          path: entryRel.replace(/\\/g, '/'),
          name,
          ext,
          size: stats.size,
          mtime: stats.mtimeMs,
          type,
        });
      }
    }
  }

  stopWatching() {
    if (this.watcher) {
      try { this.watcher.close(); } catch {}
      this.watcher = null;
    }
  }

  async listFiles({project})
  {
    return this.index.files
  }
  async readFile({project, relPath, encoding})
  {
      const abs = path.join(project.path, relPath);
      const data = await fs.readFile(abs);
      return readFileBinary({project, relPath}).toString(encoding)
  }

  async readFileBinary({project, relPath})
  {
      const abs = path.join(project.path, relPath);
      return await fs.readFile(abs);
  }
  
  async readDirectory({project, relPath})
  {
      const abs = path.join(project.path, relPath);
      return fs.readdir(abs, { withFileTypes: true });
  }

  async writeFile({project, relPath, content, encoding})
  {
      const abs = path.join(project.path, relPath);
      const dir = path.dirname(abs);
      await fs.mkdir(dir, { recursive: true });
      
      if (content instanceof Uint8Array || Buffer.isBuffer(content)) {
        await fs.writeFile(abs, content);
      } else {
        await fs.writeFile(abs, content, { encoding });
      }
      await this.__rebuildAndNotify('File written: ' + relPath);
  }

  async deleteFile({project, relPath})
  {
    const abs = path.join(project.path, relPath);
    
    const st = await fs.lstat(abs);
    if (st.isDirectory()) {
      await fs.rm(abs, { recursive: true, force: true });
    } else {
      await fs.unlink(abs);
    }
    await this.__rebuildAndNotify('File deleted: ' + relPath);
  }

  async renameFile({project, relPathSource, relPathTarget})
  {
    const absSource = path.join(project.path, relPathSource);
    const absTarget = path.join(project.path, relPathTarget);
    const targetDir = path.dirname(absTarget);
    
    await fs.mkdir(targetDir, { recursive: true });
    await fs.rename(absSource, absTarget);
    await this.__rebuildAndNotify('File renamed from: ' + relPathSource + ' to: ' + relPathTarget);
  }
  async uploadFile({project, name, content})
  {
    const uploadsDir = path.join(project.path, 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, name);
    
    if (content instanceof Uint8Array || Buffer.isBuffer(content)) {
      await fs.writeFile(filePath, content);
    } else {
      await fs.writeFile(filePath, content, { encoding: 'utf8' });
    }
    await this.__rebuildAndNotify('File uploaded: ' + name);
  }
}
