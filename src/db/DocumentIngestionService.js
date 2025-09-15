"use strict";

import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { classifyDocumentType } from './fileTyping.js';

// Basic globless ignore rules for repository scanning
const DEFAULT_INGESTION_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.factory',
  '.vite',
  '.idea',
  '.vscode',
  'dist',
  'build',
  'out',
  '.next',
  '.svelte-kit',
  '.turbo',
  '.cache',
]);

const DEFAULT_INGESTION_IGNORE_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'icon.png',
  'icon2.jpeg',
  'icon3.jpeg',
]);

function sha1(input) {
  return crypto.createHash('sha1').update(input).digest('hex');
}

async function isDirectory(p) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch (_) {
    return false;
  }
}

async function safeReadFile(absPath, encoding = 'utf8') {
  try {
    return await fs.readFile(absPath, encoding);
  } catch (e) {
    return null;
  }
}

export default class DocumentIngestionService {
  constructor(opts) {
    this.logger = opts?.logger || console;
    this.projectsManager = opts?.projectsManager;
    this.repoRoot = opts?.repoRoot || process.cwd();

    // db client is optional for scaffolding; script ensures global thefactory-db is initialized
    // We will import lazily to work both from Electron main and from the dev script.
    this._db = null;
  }

  async _getDb() {
    if (this._db) return this._db;
    const mod = await import('thefactory-db');
    this._db = mod;
    return this._db;
  }

  async syncAllProjects() {
    const projects = this.projectsManager?.listProjects?.() || [];
    const results = [];
    for (const p of projects) {
      results.push({ projectId: p.id, ...(await this.syncProject(p.id)) });
    }
    return results;
  }

  async syncProject(projectId) {
    const project = this.projectsManager?.getProject?.(projectId);
    if (!project) return { ok: false, error: `Project not found: ${projectId}` };

    const rootDir = await this._resolveProjectRoot(project);
    const files = await this._collectFiles(rootDir);

    const { addDocument, updateDocument, getDocumentById } = await this._getDb();

    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const relPath of files) {
      try {
        const abs = path.join(rootDir, relPath);
        const content = await safeReadFile(abs, 'utf8');
        if (content == null) {
          skipped++;
          continue;
        }
        const ext = this._extname(relPath);
        const type = classifyDocumentType(ext, relPath);
        const sourceId = this._makeDocId(projectId, relPath);
        const contentHash = sha1(content);

        const existing = await getDocumentById(sourceId).catch(() => null);
        if (!existing) {
          await addDocument({
            id: sourceId,
            projectId,
            type,
            path: relPath,
            content,
            contentHash,
            metadata: { projectId, path: relPath, type },
          });
          added++;
        } else if (existing.contentHash !== contentHash || existing.content !== content) {
          await updateDocument(sourceId, {
            type,
            path: relPath,
            content,
            contentHash,
            metadata: { ...(existing.metadata || {}), projectId, path: relPath, type },
          });
          updated++;
        } else {
          skipped++;
        }
      } catch (e) {
        errors.push({ file: relPath, error: e?.message || String(e) });
      }
    }

    const summary = { ok: errors.length === 0, added, updated, skipped, errors };
    this.logger?.log?.(`[ingestion] ${projectId} added=${added} updated=${updated} skipped=${skipped}`);
    return summary;
  }

  async _resolveProjectRoot(project) {
    // If project.json has a root or path, prefer it; else use repo root
    const hint = project?.root || project?.path || project?.dir;
    if (hint) return path.isAbsolute(hint) ? hint : path.join(this.repoRoot, hint);
    // default to repo root for now
    return this.repoRoot;
  }

  async _collectFiles(rootDir) {
    const files = [];
    await this._walk(rootDir, '', files);
    return files;
  }

  async _walk(rootDir, sub, out) {
    const abs = path.join(rootDir, sub);
    let entries = [];
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const e of entries) {
      const name = e.name;
      if (e.isDirectory()) {
        if (DEFAULT_INGESTION_IGNORE_DIRS.has(name)) continue;
        await this._walk(rootDir, path.join(sub, name), out);
      } else if (e.isFile()) {
        if (DEFAULT_INGESTION_IGNORE_FILES.has(name)) continue;
        const rel = path.join(sub, name).replaceAll('\\', '/');
        out.push(rel);
      }
    }
  }

  _extname(relPath) {
    const base = relPath.split('/').pop();
    if (!base) return '';
    const i = base.lastIndexOf('.');
    if (i <= 0) return '';
    return base.slice(i + 1).toLowerCase();
  }

  _makeDocId(projectId, relPath) {
    // stable id derived from project and path
    return `${projectId}:${relPath}`;
  }
}
