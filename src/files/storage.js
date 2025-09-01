import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';


export default class FilesStorage {
  constructor(projectId, filesDir, window) {
    this.projectId = projectId;
    this.filesDir = filesDir;
    this.window = window;
    this.watcher = null;

    this.files = []
  }

  async init() {
    await this.__buildIndex();
    await this.__startWatcher();
  }

  async __startWatcher() {
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

    this.watcher
      .on('add', (p) => this.__rebuildAndNotify(`File added: ${p}`))
      .on('change', (p) => this.__rebuildAndNotify(`File changed: ${p}`))
      .on('unlink', (p) => this.__rebuildAndNotify(`File removed: ${p}`))
      .on('addDir', (p) => this.__rebuildAndNotify(`Dir added: ${p}`))
      .on('unlinkDir', (p) => this.__rebuildAndNotify(`Dir removed: ${p}`));
  }

  stopWatching() {
    if (this.watcher) {
      try { this.watcher.close(); } catch {}
      this.watcher = null;
    }
  }

  __notify(logMessage) {
    if (logMessage) console.log(logMessage);
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, this.files);
    }
  }
  async __rebuildAndNotify(logMessage) {
    await this.__buildIndex();
    this.__notify(logMessage)
  }

  async __buildIndex() {
    try {
      const s = await fs.stat(this.filesDir);
      if (!s.isDirectory()) throw new Error('filesDir is not a directory');
    } catch (e) {
      return;
    }

    const files = [];

    await this._walkAndIndex('', files);

    this.files = files.sort((a, b) => a.path.localeCompare(b.path));
  }

  async _walkAndIndex(relDir, filesAcc) {
    const absDir = path.join(this.filesDir, relDir);
    let entries;
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch (e) {
      if (e && e.code === 'ENOENT') return;
      return;
    }

    // const dirStats = await fs.stat(entryAbs);
    // filesAcc.push({
    //   isDirectory: true,
    //   path: relDir,
    //   name: path.basename(relDir),
    //   size: dirStats.size,
    //   mtime: dirStats.mtimeMs
    // });

    for (const entry of entries) {
      const entryRel = relDir ? path.join(relDir, entry.name) : entry.name;
      const entryAbs = path.join(this.filesDir, entryRel);

      // Skip ignored folders similar to watcher
      if (entry.isDirectory()) {
        if (/^(node_modules|dist|out|build|\.git|\.cache|coverage|\.next|\.vite|tmp|\.DS_STORE)$/i.test(entry.name)) {
          continue;
        }
        await this._walkAndIndex(entryRel, filesAcc);
      } else if (entry.isFile()) {
        if (/^(\.DS_STORE)$/i.test(entry.name)) {
          continue;
        }
        let stats;
        try {
          stats = await fs.stat(entryAbs);
        } catch (e) {
          continue;
        }
        const name = path.basename(entryRel);
        const i = name.lastIndexOf('.');
        const ext = i >= 0 ? name.slice(i + 1).toLowerCase() : undefined;
        filesAcc.push({
          path: entryRel.replace(/\\/g, '/'),
          name,
          ext,
          size: stats.size,
          mtime: stats.mtimeMs
        });
      }
    }
  }

  async listFiles() {
    return this.files;
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
