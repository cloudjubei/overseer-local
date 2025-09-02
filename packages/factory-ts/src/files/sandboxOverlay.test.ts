import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { SandboxOverlay } from './sandboxOverlay';

function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-ts-proj-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'hello.txt'), 'hello\nworld\n', 'utf8');
  return dir;
}

describe('SandboxOverlay', () => {
  it('writes to overlay, computes pending changes, and accepts into working tree', async () => {
    const root = makeTempProject();
    const overlay = new SandboxOverlay({ projectRoot: root, id: 't1' });
    await overlay.init();
    await overlay.write('src/hello.txt', 'hello\nfriend\n');
    await overlay.write('src/new.txt', 'new file\n');

    // workspace unchanged
    expect(fs.readFileSync(path.join(root, 'src', 'hello.txt'), 'utf8')).toBe('hello\nworld\n');
    expect(fs.existsSync(path.join(root, 'src', 'new.txt'))).toBe(false);

    const changes = await overlay.getPendingChanges();
    const paths = changes.map(c => c.path).sort();
    expect(paths).toEqual(['src/hello.txt', 'src/new.txt']);

    await overlay.acceptAll();

    expect(fs.readFileSync(path.join(root, 'src', 'hello.txt'), 'utf8')).toBe('hello\nfriend\n');
    expect(fs.readFileSync(path.join(root, 'src', 'new.txt'), 'utf8')).toBe('new file\n');

    await overlay.cleanup();
    expect(fs.existsSync(path.join(root, '.overseer-overlay', 't1'))).toBe(false);
  });

  it('prevents path escape and enforces allowlist', async () => {
    const root = makeTempProject();
    const overlay = new SandboxOverlay({ projectRoot: root, allowedDirs: ['src'] });
    await overlay.init();
    await expect(overlay.write('../evil.txt', 'x')).rejects.toThrow();
    await expect(overlay.write('README.md', 'x')).rejects.toThrow();
  });

  it('deletes and renames via overlay markers', async () => {
    const root = makeTempProject();
    const overlay = new SandboxOverlay({ projectRoot: root });
    await overlay.init();
    await overlay.delete('src/hello.txt');
    await overlay.rename('src/hello.txt', 'src/greeting.txt');
    await overlay.acceptAll();
    expect(fs.existsSync(path.join(root, 'src', 'hello.txt'))).toBe(false);
    // rename may have no content if not written; but file should not exist unless created separately
    expect(fs.existsSync(path.join(root, 'src', 'greeting.txt'))).toBe(false);
  });
});
