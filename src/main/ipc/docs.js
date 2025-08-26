import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import DocsIndexer from '../../docs/indexer.js';

let registered = false;
let indexer = null;
let projectRootRef = null;

export function registerDocsIpcHandlers(projectRoot, options = {}) {
  if (registered) return;
  registered = true;
  projectRootRef = projectRoot;

  indexer = new DocsIndexer(projectRoot, options);
  // Init indexer and start polling
  Promise.resolve(indexer.init()).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('DocsIndexer init failed:', err);
  });

  // Handle get index snapshot
  ipcMain.handle('docs-index:get', async () => {
    return indexer.getIndex();
  });

  // Broadcast updates to all windows
  indexer.onUpdate((snapshot) => {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.send('docs-index:update', snapshot);
      } catch (e) {
        // ignore
      }
    }
  });

  // Read .md file content by relative path under docs/
  ipcMain.handle('docs-file:get', async (_event, relPath) => {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      throw new Error('Invalid path');
    }

    // Normalize and prevent path traversal
    const normalized = path.normalize(relPath).replace(/^([/\\])+/, '');
    if (!/\.md$/i.test(normalized)) {
      throw new Error('Only .md files are allowed');
    }

    const docsDir = path.resolve(path.join(projectRootRef, 'docs'));
    const absPath = path.resolve(path.join(docsDir, normalized));

    if (!absPath.startsWith(docsDir + path.sep) && absPath !== docsDir) {
      throw new Error('Path is outside docs directory');
    }

    let content;
    try {
      content = await fs.readFile(absPath, 'utf8');
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      throw new Error(`Failed to read file: ${msg}`);
    }
    return content;
  });
}
