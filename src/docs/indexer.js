import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';

export class DocsIndexer {
  constructor(projectRoot, window, options = {}) {
    this.projectRoot = projectRoot;
    this.docsDir = path.join(projectRoot, 'docs');
    this.window = window;
    this.options = {
      maxTitleBytes: options.maxTitleBytes || 64 * 1024,
    };

    this.index = {
      root: projectRoot,
      docsDir: this.docsDir,
      updatedAt: null,
      tree: this._makeDirNode('docs', '', this.docsDir),
      files: [],
      errors: [],
      metrics: { lastScanMs: 0, lastScanCount: 0 },
    };

    this.watcher = null;
  }

  _makeDirNode(name, relPath, absPath) {
    return { type: 'dir', name, relPath, absPath, dirs: [], files: [] };
  }

  _makeFileNode(relPath, absPath, stats, title, headings) {
    return {
      type: 'file',
      name: path.basename(relPath),
      relPath,
      absPath,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      title,
      headings,
    };
  }

  getIndex() {
    return this.index;
  }

  async init() {
    await this.buildIndex();
    this.watcher = chokidar.watch(path.join(this.docsDir, '**/*.md'), {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', (p) => this.rebuildAndNotify(`Doc added: ${p}`))
      .on('change', (p) => this.rebuildAndNotify(`Doc changed: ${p}`))
      .on('unlink', (p) => this.rebuildAndNotify(`Doc removed: ${p}`))
      .on('addDir', (p) => this.rebuildAndNotify(`Dir added: ${p}`))
      .on('unlinkDir', (p) => this.rebuildAndNotify(`Dir removed: ${p}`));
  }

  async rebuildAndNotify(logMessage) {
    if (logMessage) console.log(logMessage);
    await this.buildIndex();
    if (this.window) {
      this.window.webContents.send('docs-index:update', this.getIndex());
    }
  }

  async buildIndex() {
    const startTime = Date.now();
    const newIndex = {
      ...this.index,
      updatedAt: new Date().toISOString(),
      tree: this._makeDirNode('docs', '', this.docsDir),
      files: [],
      errors: [],
    };

    // Verify docsDir exists
    let docsDirExists = true;
    try {
      const s = await fs.stat(this.docsDir);
      docsDirExists = s.isDirectory();
    } catch (e) {
      docsDirExists = false;
      if (e && e.code !== 'ENOENT') {
        newIndex.errors.push({ file: this.docsDir, errors: [e.message || String(e)] });
      }
    }

    if (docsDirExists) {
      try {
        await this._walkAndIndex('', newIndex.tree, newIndex.files, newIndex.errors);
      } catch (e) {
        newIndex.errors.push({ file: this.docsDir, errors: [e.message || String(e)] });
      }

      // Sort directories and files for stable ordering
      const sortTree = (dirNode) => {
        dirNode.dirs.sort((a, b) => a.name.localeCompare(b.name));
        dirNode.files.sort((a, b) => a.name.localeCompare(b.name));
        for (const d of dirNode.dirs) sortTree(d);
      };
      sortTree(newIndex.tree);

      newIndex.files.sort((a, b) => a.relPath.localeCompare(b.relPath));
    }

    this.index = newIndex;
    this.index.metrics.lastScanMs = Date.now() - startTime;
    this.index.metrics.lastScanCount = this.index.files.length;
  }

  async _walkAndIndex(relDir, dirNode, filesAcc, errorsAcc) {
    const absDir = path.join(this.docsDir, relDir);
    let entries;
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch (e) {
      errorsAcc.push({ type: 'readdir', dir: absDir, message: e.message || String(e) });
      return;
    }

    for (const entry of entries) {
      const entryRel = relDir ? path.join(relDir, entry.name) : entry.name;
      const entryAbs = path.join(this.docsDir, entryRel);
      if (entry.isDirectory()) {
        const childDir = this._makeDirNode(entry.name, entryRel, entryAbs);
        dirNode.dirs.push(childDir);
        await this._walkAndIndex(entryRel, childDir, filesAcc, errorsAcc);
      } else if (entry.isFile()) {
        if (!/\.md$/i.test(entry.name)) continue;
        let stats;
        try {
          stats = await fs.stat(entryAbs);
        } catch (e) {
          errorsAcc.push({ type: 'stat', file: entryAbs, message: e.message || String(e) });
          continue;
        }

        let title = null;
        let headings = [];
        try {
          const extracted = await this._extractHeadings(entryAbs, stats.size);
          title = extracted.title;
          headings = extracted.headings;
        } catch (e) {
          errorsAcc.push({ type: 'parse', file: entryAbs, message: e.message || String(e) });
        }

        const fileNode = this._makeFileNode(entryRel, entryAbs, stats, title, headings);
        dirNode.files.push(fileNode);
        filesAcc.push(fileNode);
      }
    }
  }

  async _extractHeadings(absPath, size) {
    const maxRead = Math.min(size || this.options.maxTitleBytes, this.options.maxTitleBytes);
    let fh;
    try {
      fh = await fs.open(absPath, 'r');
      const buffer = Buffer.allocUnsafe(maxRead);
      const { bytesRead } = await fh.read({ buffer, offset: 0, length: maxRead, position: 0 });
      const text = buffer.slice(0, bytesRead).toString('utf8');

      const lines = text.split(/\r?\n/);
      let title = null;
      const headings = [];
      let inCodeFence = false;

      for (const line of lines) {
        const fence = line.match(/^\s*```/);
        if (fence) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
        const m = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (m) {
          const level = m[1].length;
          const hText = m[2].trim();
          headings.push({ level, text: hText });
          if (!title && level === 1) title = hText;
        }
      }

      if (!title) {
        title = path.basename(absPath).replace(/\.[^/.]+$/, '');
      }

      return { title, headings };
    } finally {
      if (fh) await fh.close();
    }
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
