import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type OverlayChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface OverlayChange {
  path: string; // project-relative normalized path
  status: OverlayChangeStatus;
  oldPath?: string; // for renames
  oldContent?: string;
  newContent?: string;
  diff?: string;
}

export interface SandboxOverlayOptions {
  projectRoot: string;
  id?: string; // run id; used to scope overlay dir
  overlayDir?: string; // absolute path; must be within projectRoot if provided
  allowedDirs?: string[]; // project-relative dirs allowed for writes; default ['.'] (entire project)
  autoCleanup?: boolean; // default true
}

export class SandboxOverlay {
  readonly projectRoot: string;
  readonly overlayRoot: string;
  readonly id: string;
  private allowedDirs: string[];
  private initialized = false;
  private cleaned = false;

  constructor(opts: SandboxOverlayOptions) {
    this.projectRoot = path.resolve(opts.projectRoot);
    this.id = opts.id ?? `run_${Math.random().toString(36).slice(2, 10)}`;
    const defaultOverlay = path.join(this.projectRoot, '.overseer-overlay', this.id);
    this.overlayRoot = opts.overlayDir ? path.resolve(opts.overlayDir) : defaultOverlay;
    // ensure overlay in project
    if (!this.overlayRoot.startsWith(this.projectRoot + path.sep)) {
      throw new Error(`Overlay dir must be within project root: ${this.overlayRoot}`);
    }
    this.allowedDirs = (opts.allowedDirs && opts.allowedDirs.length > 0 ? opts.allowedDirs : ['.'])
      .map((p) => this.normalizeProjectPath(p));
    if (opts.autoCleanup !== false) {
      // default true; attach process exit hook
      const onExit = () => {
        try { this.cleanupSync(); } catch {}
      };
      process.once('exit', onExit);
      // do not hold event loop
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await fs.promises.mkdir(this.overlayRoot, { recursive: true });
    this.initialized = true;
  }

  attachAbortSignal(signal: AbortSignal) {
    signal.addEventListener('abort', () => {
      try { this.cleanupSync(); } catch {}
    }, { once: true });
  }

  // Public API: write, delete, rename happen in overlay only
  async write(relPath: string, content: string | Buffer): Promise<void> {
    this.ensureInit();
    const norm = this.ensureAllowed(relPath);
    const abs = path.join(this.overlayRoot, norm);
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, content);
  }

  async delete(relPath: string): Promise<void> {
    this.ensureInit();
    const norm = this.ensureAllowed(relPath);
    const abs = path.join(this.overlayRoot, norm);
    // mark as deleted by creating a tombstone file when source exists? Simpler: create a special marker dir
    // Instead we create a placeholder file .overlay-delete to indicate deletion when no overlay file exists
    const marker = abs + '.overlay-delete';
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(marker, 'delete');
  }

  async rename(fromRelPath: string, toRelPath: string): Promise<void> {
    this.ensureInit();
    const fromNorm = this.ensureAllowed(fromRelPath);
    const toNorm = this.ensureAllowed(toRelPath);
    const fromAbs = path.join(this.overlayRoot, fromNorm);
    const toAbs = path.join(this.overlayRoot, toNorm);
    await fs.promises.mkdir(path.dirname(toAbs), { recursive: true });
    // We cannot move source from working tree; overlay only. Represent rename by placing a metadata file.
    const metaPath = path.join(this.overlayRoot, '.overlay-meta');
    await fs.promises.mkdir(metaPath, { recursive: true });
    const rec = { type: 'rename', from: fromNorm, to: toNorm } as const;
    const stamp = Date.now() + '_' + Math.random().toString(36).slice(2,6);
    await fs.promises.writeFile(path.join(metaPath, `rename_${stamp}.json`), JSON.stringify(rec), 'utf8');
    // If overlay already has the file content under fromAbs, move it; otherwise it will be taken from working tree at accept time.
    try {
      await fs.promises.rename(fromAbs, toAbs);
    } catch {
      // ignore; rename will be applied during accept
    }
  }

  // Compute pending changes by comparing overlay vs working tree
  async getPendingChanges(): Promise<OverlayChange[]> {
    this.ensureInit();
    const changes: OverlayChange[] = [];
    const collect = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (p === path.join(this.overlayRoot, '.overlay-meta')) continue;
          await collect(p);
        } else {
          if (e.name.endsWith('.overlay-delete')) {
            const rel = path.relative(this.overlayRoot, p).replace(/\\/g, '/').replace(/\.overlay-delete$/, '');
            const projRel = this.normalizeProjectPath(rel);
            // Only mark delete if file exists in working tree
            const workAbs = path.join(this.projectRoot, projRel);
            if (fs.existsSync(workAbs)) {
              const oldContent = await fs.promises.readFile(workAbs, 'utf8').catch(() => undefined);
              changes.push({ path: projRel, status: 'deleted', oldContent });
            }
            continue;
          }
          if (dir.endsWith('.overlay-meta')) continue;
          const rel = path.relative(this.overlayRoot, p).replace(/\\/g, '/');
          const projRel = this.normalizeProjectPath(rel);
          const workAbs = path.join(this.projectRoot, projRel);
          const overlayContent = await fs.promises.readFile(p);
          if (fs.existsSync(workAbs)) {
            const oldContent = await fs.promises.readFile(workAbs);
            if (!overlayContent.equals(oldContent)) {
              changes.push({ path: projRel, status: 'modified', oldContent: oldContent.toString('utf8'), newContent: overlayContent.toString('utf8'), diff: simpleUnifiedDiff(oldContent.toString('utf8'), overlayContent.toString('utf8')) });
            }
          } else {
            changes.push({ path: projRel, status: 'added', newContent: overlayContent.toString('utf8') });
          }
        }
      }
    };
    if (fs.existsSync(this.overlayRoot)) {
      await collect(this.overlayRoot);
    }

    // process renames markers
    const metaDir = path.join(this.overlayRoot, '.overlay-meta');
    if (fs.existsSync(metaDir)) {
      const entries = await fs.promises.readdir(metaDir);
      for (const name of entries) {
        if (!name.startsWith('rename_')) continue;
        try {
          const rec = JSON.parse(await fs.promises.readFile(path.join(metaDir, name), 'utf8')) as { type: 'rename', from: string, to: string };
          const fromAbs = path.join(this.projectRoot, rec.from);
          const toAbs = path.join(this.projectRoot, rec.to);
          const oldContent = fs.existsSync(fromAbs) ? await fs.promises.readFile(fromAbs, 'utf8') : undefined;
          const overlayToAbs = path.join(this.overlayRoot, rec.to);
          const newContent = fs.existsSync(overlayToAbs) ? await fs.promises.readFile(overlayToAbs, 'utf8') : (fs.existsSync(toAbs) ? await fs.promises.readFile(toAbs, 'utf8') : undefined);
          changes.push({ path: rec.to, status: 'renamed', oldPath: rec.from, oldContent, newContent });
        } catch {}
      }
    }

    return changes;
  }

  // Accept all overlay changes into working tree
  async acceptAll(): Promise<void> {
    const changes = await this.getPendingChanges();
    await this.acceptFiles(changes.map(c => c.path));
  }

  async acceptFiles(files: string[]): Promise<void> {
    this.ensureInit();
    // apply renames markers first for involved files
    const metaDir = path.join(this.overlayRoot, '.overlay-meta');
    const renameRecords: { from: string; to: string }[] = [];
    if (fs.existsSync(metaDir)) {
      const entries = await fs.promises.readdir(metaDir);
      for (const name of entries) {
        if (!name.startsWith('rename_')) continue;
        try {
          const rec = JSON.parse(await fs.promises.readFile(path.join(metaDir, name), 'utf8')) as { type: 'rename', from: string, to: string };
          if (files.includes(rec.to) || files.includes(rec.from)) renameRecords.push({ from: rec.from, to: rec.to });
        } catch {}
      }
    }

    // First, deletes (including overwrites handled by copying)
    for (const rel of files) {
      const norm = this.ensureAllowed(rel);
      const delMarker = path.join(this.overlayRoot, norm) + '.overlay-delete';
      const workAbs = path.join(this.projectRoot, norm);
      if (fs.existsSync(delMarker)) {
        if (fs.existsSync(workAbs)) await fs.promises.rm(workAbs, { recursive: false, force: true });
        await fs.promises.rm(delMarker, { force: true });
      }
    }

    // Renames
    for (const r of renameRecords) {
      const fromAbs = path.join(this.projectRoot, r.from);
      const toAbs = path.join(this.projectRoot, r.to);
      await fs.promises.mkdir(path.dirname(toAbs), { recursive: true });
      if (fs.existsSync(fromAbs)) await fs.promises.rename(fromAbs, toAbs).catch(async () => {
        // fallback copy+delete
        await fs.promises.copyFile(fromAbs, toAbs);
        await fs.promises.rm(fromAbs, { force: true });
      });
      // If overlay has toAbs content, it will be copied next
    }

    // Writes (added/modified)
    for (const rel of files) {
      const norm = this.ensureAllowed(rel);
      const overlayAbs = path.join(this.overlayRoot, norm);
      const workAbs = path.join(this.projectRoot, norm);
      if (fs.existsSync(overlayAbs)) {
        await fs.promises.mkdir(path.dirname(workAbs), { recursive: true });
        await fs.promises.copyFile(overlayAbs, workAbs);
      }
    }
  }

  async rejectAll(): Promise<void> {
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    if (this.cleaned) return;
    await fs.promises.rm(this.overlayRoot, { recursive: true, force: true });
    this.cleaned = true;
  }

  cleanupSync() {
    if (this.cleaned) return;
    try { fs.rmSync(this.overlayRoot, { recursive: true, force: true }); } catch {}
    this.cleaned = true;
  }

  // Helpers
  private ensureInit() {
    if (!this.initialized) throw new Error('SandboxOverlay not initialized. Call init() first.');
  }

  private normalizeProjectPath(relPath: string): string {
    const raw = relPath.replace(/\\/g, '/');
    const norm = path.posix.normalize(raw);
    if (norm.startsWith('..')) throw new Error(`Path escapes project root: ${relPath}`);
    return norm.replace(/^\.\//, '');
  }

  private ensureAllowed(relPath: string): string {
    const norm = this.normalizeProjectPath(relPath);
    // Build absolute path and ensure within allowed dirs
    const abs = path.join(this.projectRoot, norm);
    if (!abs.startsWith(this.projectRoot + path.sep)) throw new Error(`Path escapes project root: ${relPath}`);
    // allowlist: norm must start with one of allowed dirs
    const allowed = this.allowedDirs.some((d) => {
      if (d === '') return true;
      return norm === d || norm.startsWith(d.endsWith('/') ? d : d + '/');
    });
    if (!allowed) throw new Error(`Path not allowed by allowlist: ${relPath}`);
    return norm;
  }
}

// Minimal unified diff to avoid external deps
function simpleUnifiedDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  const max = Math.max(oldLines.length, newLines.length);
  const lines: string[] = [];
  let hunkLines: string[] = [];
  let inHunk = false;
  let hunkStartOld = 1;
  let hunkStartNew = 1;
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      if (inHunk) hunkLines.push(' ' + (o ?? ''));
    } else {
      if (!inHunk) { inHunk = true; hunkStartOld = i + 1; hunkStartNew = i + 1; hunkLines = []; }
      if (o !== undefined) hunkLines.push('-' + o);
      if (n !== undefined) hunkLines.push('+' + n);
    }
    if (inHunk && (o === n || i === max - 1)) {
      const header = `@@ -${hunkStartOld},${Math.max(1, hunkLines.filter(l => l[0] !== '+').length)} +${hunkStartNew},${Math.max(1, hunkLines.filter(l => l[0] !== '-').length)} @@`;
      lines.push(header, ...hunkLines);
      inHunk = false;
    }
  }
  return ['--- a', '+++ b', ...lines].join('\n');
}
