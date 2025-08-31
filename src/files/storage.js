import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
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

export default class FilesStorage {
  constructor(projectId, filesDir, window) {
    this.projectId = projectId;
    this.filesDir = filesDir;
    this.window = window;
    this.index = {
      filesDir: this.filesDir,
      updatedAt: null,
      files: [],
      errors: [],
      metrics: { lastScanMs: 0, lastScanCount: 0 },
    };
    this.watcher = null;
  }

  async init() {
    await this.buildIndex();
    await this.startWatcher();
  }

  async startWatcher() {
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
        this.window.webContents.send(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, { projectId: this.projectId });
      }
    };

    this.watcher
      .on('add', (p) => onChange(`File added: ${p}`))
      .on('change', (p) => onChange(`File changed: ${p}`))
      .on('unlink', (p) => onChange(`File removed: ${p}`))
      .on('addDir', (p) => onChange(`Dir added: ${p}`))
      .on('unlinkDir', (p) => onChange(`Dir removed: ${p}`));
  }

  stopWatching() {
    if (this.watcher) {
      try { this.watcher.close(); } catch {}
      this.watcher = null;
    }
  }

  async rebuildAndNotify(logMessage) {
    if (logMessage) console.log(logMessage);
    await this.buildIndex();
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, { projectId: this.projectId });
    }
  }

  async buildIndex() {
    const start = Date.now();
    const newIndex = {
      ...this.index,
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

  async listFiles() {
    return this.index.files;
  }

  async readFile(relPath, encoding) {
    const data = await this.readFileBinary(relPath);
    return data.toString(encoding);
  }

  async readFileBinary(relPath) {
    const abs = path.join(this.filesDir, relPath);
    return await fs.readFile(abs);
  }

  async readDirectory(relPath) {
    const abs = path.join(this.filesDir, relPath);
    return await fs.readdir(abs, { withFileTypes: true });
  }

  async writeFile(relPath, content, encoding) {
    const abs = path.join(this.filesDir, relPath);
    const dir = path.dirname(abs);
    await fs.mkdir(dir, { recursive: true });
    if (content instanceof Uint8Array || Buffer.isBuffer(content)) {
      await fs.writeFile(abs, content);
    } else {
      await fs.writeFile(abs, content, { encoding });
    }
    await this.rebuildAndNotify('File written: ' + relPath);
  }

  async deleteFile(relPath) {
    const abs = path.join(this.filesDir, relPath);
    const st = await fs.lstat(abs);
    if (st.isDirectory()) {
      await fs.rm(abs, { recursive: true, force: true });
    } else {
      await fs.unlink(abs);
    }
    await this.rebuildAndNotify('File deleted: ' + relPath);
  }

  async renameFile(relPathSource, relPathTarget) {
    const absSource = path.join(this.filesDir, relPathSource);
    const absTarget = path.join(this.filesDir, relPathTarget);
    const targetDir = path.dirname(absTarget);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.rename(absSource, absTarget);
    await this.rebuildAndNotify('File renamed from: ' + relPathSource + ' to: ' + relPathTarget);
  }

  async uploadFile(name, content) {
    const uploadsDir = path.join(this.filesDir, 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, name);
    if (content instanceof Uint8Array || Buffer.isBuffer(content)) {
      await fs.writeFile(filePath, content);
    } else {
      await fs.writeFile(filePath, content, { encoding: 'utf8' });
    }
    await this.rebuildAndNotify('File uploaded: ' + name);
  }
}
