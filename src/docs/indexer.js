import fs from 'fs/promises'
import path from 'path';
import chokidar from 'chokidar';
import EventEmitter from 'events';

export class DocsIndexer {
  constructor(projectRoot, options = {}) {
    this.root = projectRoot;
    this.docsDir = path.join(projectRoot, "docs");
    this.options = {
      pollingIntervalMs: options.pollingIntervalMs || 1000,
      maxTitleBytes: options.maxTitleBytes || 64 * 1024, // limit when reading first heading
    };

    this._index = this._emptyIndex();
    this._pollTimer = null;
    this._lastSignature = null;
    this._emitter = new EventEmitter();
    this._building = false;
  }

  _emptyIndex() {
    return {
      root: this.root,
      docsDir: this.docsDir,
      updatedAt: null,
      tree: this._makeDirNode("docs", "", this.docsDir),
      files: [],
      errors: [],
      metrics: {
        lastScanMs: 0,
        lastScanCount: 0,
      },
    };
  }

  _makeDirNode(name, relPath, absPath) {
    return {
      type: "dir",
      name,
      relPath, // relative to docsDir
      absPath,
      dirs: [],
      files: [],
    };
  }

  _makeFileNode(relPath, absPath, stats, title, headings) {
    return {
      type: "file",
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
    // Return a shallow copy snapshot to discourage external mutation
    return { ...this._index };
  }

  onUpdate(cb) {
    this._emitter.on("update", cb);
    return () => this._emitter.off("update", cb);
  }

  async init() {
    await this.buildIndex();
    this._startPolling();
    return this.getIndex();
  }

  stopWatching() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  _startPolling() {
    this.stopWatching();
    this._pollTimer = setInterval(async () => {
      try {
        const sig = this._computeSignature();
        if (sig !== this._lastSignature) {
          await this.buildIndex();
        }
      } catch (err) {
        // Swallow polling errors; detailed errors will appear during buildIndex
      }
    }, this.options.pollingIntervalMs);
    if (this._pollTimer && this._pollTimer.unref) {
      // Allow process to exit if nothing else is pending
      this._pollTimer.unref();
    }
  }

  async buildIndex() {
    if (this._building) return; // avoid concurrent builds
    this._building = true;
    const start = Date.now();

    const nextIndex = this._emptyIndex();
    const errors = [];

    if (!fs.existsSync(this.docsDir)) {
      // docs directory missing; keep empty index and signature
      this._lastSignature = this._computeSignature();
      nextIndex.updatedAt = new Date().toISOString();
      nextIndex.errors = errors;
      nextIndex.metrics.lastScanMs = Date.now() - start;
      nextIndex.metrics.lastScanCount = 0;
      this._index = nextIndex;
      this._emitter.emit("update", this.getIndex());
      this._building = false;
      return;
    }

    const dirMap = new Map();
    dirMap.set("", nextIndex.tree);

    const ensureDirNode = (relDir) => {
      if (dirMap.has(relDir)) return dirMap.get(relDir);
      const abs = path.join(this.docsDir, relDir);
      const name = relDir === "" ? "docs" : path.basename(relDir);
      const node = this._makeDirNode(name, relDir, abs);
      // attach to parent
      const parentRel = path.dirname(relDir);
      const parent = ensureDirNode(parentRel === "." ? "" : parentRel);
      parent.dirs.push(node);
      dirMap.set(relDir, node);
      return node;
    };

    const files = [];

    const walk = (relDir) => {
      const absDir = path.join(this.docsDir, relDir);
      let entries;
      try {
        entries = fs.readdirSync(absDir, { withFileTypes: true });
      } catch (err) {
        errors.push({ type: "readdir", dir: absDir, message: String(err && err.message || err) });
        return;
      }

      for (const entry of entries) {
        const entryRel = relDir ? path.join(relDir, entry.name) : entry.name;
        const entryAbs = path.join(this.docsDir, entryRel);
        if (entry.isDirectory()) {
          ensureDirNode(entryRel);
          walk(entryRel);
        } else if (entry.isFile()) {
          if (!/\.md$/i.test(entry.name)) continue; // only markdown
          let stats;
          try {
            stats = fs.statSync(entryAbs);
          } catch (err) {
            errors.push({ type: "stat", file: entryAbs, message: String(err && err.message || err) });
            continue;
          }
          let title = null;
          let headings = [];
          try {
            const { title: t, headings: h } = this._extractHeadings(entryAbs);
            title = t;
            headings = h;
          } catch (err) {
            // Non-fatal: still index the file
            errors.push({ type: "parse", file: entryAbs, message: String(err && err.message || err) });
          }
          const fileNode = this._makeFileNode(entryRel, entryAbs, stats, title, headings);
          files.push(fileNode);
          const parentRel = relDir;
          const parent = ensureDirNode(parentRel);
          parent.files.push(fileNode);
        }
      }
    };

    // Start walking from root of docs
    walk("");

    // Sort directories and files for stable ordering
    for (const [, dir] of dirMap) {
      dir.dirs.sort((a, b) => a.name.localeCompare(b.name));
      dir.files.sort((a, b) => a.name.localeCompare(b.name));
    }

    nextIndex.files = files.sort((a, b) => a.relPath.localeCompare(b.relPath));
    nextIndex.errors = errors;
    nextIndex.updatedAt = new Date().toISOString();
    nextIndex.metrics.lastScanMs = Date.now() - start;
    nextIndex.metrics.lastScanCount = nextIndex.files.length;

    // Update signature
    this._lastSignature = this._computeSignature();

    // Publish
    this._index = nextIndex;
    this._emitter.emit("update", this.getIndex());
    this._building = false;
  }

  _extractHeadings(absPath) {
    // Read up to maxTitleBytes for efficiency; for headings we will read the whole file only if small
    const stat = fs.statSync(absPath);
    const maxRead = Math.min(stat.size, this.options.maxTitleBytes);
    const fd = fs.openSync(absPath, "r");
    try {
      const buffer = Buffer.allocUnsafe(maxRead);
      fs.readSync(fd, buffer, 0, maxRead, 0);
      let text = buffer.toString("utf8");

      // If file is bigger than maxRead, we might miss later headings; acceptable for title extraction
      // Extract headings that look like Markdown ATX headings (#..######)
      const lines = text.split(/\r?\n/);
      let title = null;
      const headings = [];
      let inCodeFence = false;
      for (const line of lines) {
        const fenceMatch = line.match(/^\s*```/);
        if (fenceMatch) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
        const m = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (m) {
          const level = m[1].length;
          const text = m[2].trim();
          headings.push({ level, text });
          if (!title && level === 1) title = text;
        }
        if (!title && !/^\s*$/.test(line)) {
          // As a fallback, the first non-empty line can be a title if no H1 found later
        }
      }
      if (!title) {
        // Fallback to file name without extension
        title = path.basename(absPath).replace(/\.[^/.]+$/, "");
      }
      return { title, headings };
    } finally {
      fs.closeSync(fd);
    }
  }

  _computeSignature() {
    // Signature based on list of markdown files and their sizes + mtimes
    if (!fs.existsSync(this.docsDir)) return "<no-docs-dir>";
    const entries = [];

    const walk = (absDir, relDir) => {
      let dirents;
      try {
        dirents = fs.readdirSync(absDir, { withFileTypes: true });
      } catch (e) {
        entries.push(`ERR:${relDir}`);
        return;
      }
      for (const d of dirents) {
        const abs = path.join(absDir, d.name);
        const rel = relDir ? path.join(relDir, d.name) : d.name;
        if (d.isDirectory()) {
          walk(abs, rel);
        } else if (d.isFile()) {
          if (!/\.md$/i.test(d.name)) continue;
          try {
            const s = fs.statSync(abs);
            entries.push(`${rel}|${s.size}|${Math.floor(s.mtimeMs)}`);
          } catch (e) {
            entries.push(`${rel}|ERR`);
          }
        }
      }
    };

    walk(this.docsDir, "");
    entries.sort();
    return entries.join("\n");
  }
}
