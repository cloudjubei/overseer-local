const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');

class DocsIndexer {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.docsDir = path.join(projectRoot, 'docs');
    this._index = {
      root: projectRoot,
      docsDir: this.docsDir,
      updatedAt: null,
      docsTree: null,
      filesByPath: {},
      errors: [],
      metrics: { lastScanMs: 0, lastScanCount: 0 }
    };
    this.watcher = null;
  }

  getIndex() {
    return JSON.parse(JSON.stringify(this._index));
  }

  async init() {
    await this.buildIndex();
    this.startWatching();
  }

  async buildIndex() {
    const start = Date.now();
    let count = 0;
    const errors = [];
    let tree = null;
    try {
      tree = await this._buildTree(this.docsDir, '');
      count = this._countFiles(tree);
    } catch (err) {
      errors.push(err.message);
    }
    this._index = {
      ...this._index,
      updatedAt: new Date(),
      docsTree: tree,
      filesByPath: tree ? this._flattenFiles(tree) : {},
      errors,
      metrics: { lastScanMs: Date.now() - start, lastScanCount: count }
    };
  }

  async _buildTree(dirPath, relPath) {
    const name = path.basename(dirPath);
    const tree = { name, type: 'directory', path: relPath, children: [] };
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (err) {
      throw new Error(`Failed to read directory ${dirPath}: ${err.message}`);
    }
    for (const entry of entries) {
      const entryRelPath = path.join(relPath, entry.name);
      const entryFullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subTree = await this._buildTree(entryFullPath, entryRelPath);
        tree.children.push(subTree);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        let stats;
        try {
          stats = await fs.stat(entryFullPath);
        } catch (err) {
          console.error(`Stat failed for ${entryFullPath}: ${err}`);
          continue;
        }
        tree.children.push({
          name: entry.name,
          type: 'file',
          path: entryRelPath,
          metadata: {
            lastModified: stats.mtime,
            size: stats.size
          }
        });
      }
    }
    return tree;
  }

  _flattenFiles(tree, map = {}) {
    if (tree.type === 'file') {
      map[tree.path] = tree;
    }
    if (tree.children) {
      tree.children.forEach(child => this._flattenFiles(child, map));
    }
    return map;
  }

  _countFiles(tree) {
    if (!tree) return 0;
    let count = tree.type === 'file' ? 1 : 0;
    if (tree.children) {
      tree.children.forEach(child => { count += this._countFiles(child); });
    }
    return count;
  }

  startWatching() {
    if (this.watcher) return;
    this.watcher = chokidar.watch(this.docsDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: true
    }).on('all', (event, filePath) => {
      console.log(`Docs dir change: ${event} ${filePath}`);
      this.buildIndex();
    });
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

module.exports = { DocsIndexer };