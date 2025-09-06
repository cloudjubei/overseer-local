import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

let PROJECT_ROOT = path.resolve(process.cwd());

function setProjectRoot(p: string) { PROJECT_ROOT = path.resolve(p); }
function getProjectRoot() { return PROJECT_ROOT; }

async function ensureDir(p: string) { await fsp.mkdir(p, { recursive: true }); }

function isWithinRootFactory(rootGetter: () => string) {
  return function isWithinRoot(abs: string) {
    const root = rootGetter();
    const normRoot = path.resolve(root) + path.sep;
    const normAbs = path.resolve(abs) + path.sep;
    return normAbs.startsWith(normRoot) || path.resolve(abs) === path.resolve(root);
  }
}

async function readFilesImpl(rootGetter: () => string, isWithinRoot: (abs: string) => boolean, pathsRel: string[]): Promise<string> {
  const result: Record<string, any> = {};
  for (const rel of pathsRel) {
    try {
      const abs = path.resolve(rootGetter(), rel);
      if (!isWithinRoot(abs)) { result[rel] = 'SECURITY ERROR: Cannot access path outside project directory.\n'; continue; }
      const st = await fsp.stat(abs).catch(() => null);
      if (!st) { result[rel] = 'Path not found or is not a regular file/directory.'; continue; }
      if (st.isDirectory()) {
        const entries = await fsp.readdir(abs);
        result[rel] = entries;
      } else if (st.isFile()) {
        result[rel] = await fsp.readFile(abs, 'utf8');
      } else {
        result[rel] = 'Path not found or is not a regular file/directory.';
      }
    } catch (e) {
      result[rel] = String(e);
    }
  }
  return JSON.stringify(result, null, 0);
}

async function listFilesImpl(rootGetter: () => string, isWithinRoot: (abs: string) => boolean, relPath: string): Promise<string[]> {
  try {
    const abs = path.resolve(rootGetter(), relPath);
    if (!isWithinRoot(abs)) return [];
    const st = await fsp.stat(abs).catch(() => null);
    if (!st || !st.isDirectory()) return [];
    const entries = await fsp.readdir(abs);
    return entries;
  } catch {
    return [];
  }
}

async function writeFileImpl(rootGetter: () => string, isWithinRoot: (abs: string) => boolean, relPath: string, content: string) {
  const abs = path.resolve(rootGetter(), relPath);
  if (!isWithinRoot(abs)) throw new Error(`Security violation: Attempt to write outside of project root: ${relPath}`);
  await ensureDir(path.dirname(abs));
  await fsp.writeFile(abs, content, 'utf8');
  return `File securely written to: ${relPath}`;
}

async function renameFileImpl(rootGetter: () => string, isWithinRoot: (abs: string) => boolean, srcRel: string, dstRel: string) {
  const src = path.resolve(rootGetter(), srcRel);
  const dst = path.resolve(rootGetter(), dstRel);
  if (!isWithinRoot(src)) throw new Error(`Security violation: Attempt to read outside of project root: ${srcRel}`);
  if (!isWithinRoot(dst)) throw new Error(`Security violation: Attempt to write outside of project root: ${dstRel}`);
  await ensureDir(path.dirname(dst));
  await fsp.rename(src, dst);
  return `File ${srcRel} securely renamed to: ${dstRel}`;
}

async function deleteFileImpl(rootGetter: () => string, isWithinRoot: (abs: string) => boolean, relPath: string) {
  const abs = path.resolve(rootGetter(), relPath);
  if (!isWithinRoot(abs)) throw new Error(`Security violation: Attempt to delete outside of project root: ${relPath}`);
  const st = await fsp.stat(abs).catch(() => null);
  if (!st) return `File not found: ${relPath}`;
  if (st.isDirectory()) {
    await fsp.rmdir(abs);
  } else {
    await fsp.unlink(abs).catch(() => {});
  }
  return `File securely deleted: ${relPath}`;
}

async function searchFilesImpl(rootGetter: () => string, isWithinRoot: (abs: string) => boolean, query: string, relPath = '.'): Promise<string[]> {
  if (!query) return [];
  const root = rootGetter();
  const start = path.resolve(root, relPath);
  if (!isWithinRoot(start)) return [];

  const ignore = new Set(['.git', 'node_modules', '.venv', 'venv', 'dist', 'build', 'out', '.next', '.cache']);
  const maxBytes = 2 * 1024 * 1024;
  const queries = query.toLowerCase().split(" ");
  const matches: string[] = [];
  const seen = new Set<string>();

  const walk = async (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch { return; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = path.relative(root, full);
      if (!isWithinRoot(full)) continue;
      if (ent.isDirectory()) {
        if (ignore.has(ent.name)) continue;
        await walk(full);
      } else if (ent.isFile()) {
        let added = false;
        for(const q of queries){
          if (ent.name.toLowerCase().includes(q)) {
            if (!seen.has(rel)) { matches.push(rel); seen.add(rel); }
            added = true;
            break
          }
          if (!added) {
            try {
              const st = await fsp.stat(full);
              if (st.size <= maxBytes) {
                const data = await fsp.readFile(full);
                const text = data.toString('utf8');
                if (text.toLowerCase().includes(q)) {
                  if (!seen.has(rel)) { matches.push(rel); seen.add(rel); }
                }
              }
            } catch {}
          }
        }
        if (matches.length >= 500) return; // cap results
      }
    }
  };

  await walk(start);
  return matches;
}

// Default, process-global tools (backwards-compatible)
const defaultIsWithinRoot = isWithinRootFactory(getProjectRoot);
async function readFiles(pathsRel: string[]): Promise<string> { return readFilesImpl(getProjectRoot, defaultIsWithinRoot, pathsRel); }
async function listFiles(relPath: string): Promise<string[]> { return listFilesImpl(getProjectRoot, defaultIsWithinRoot, relPath); }
async function writeFile(relPath: string, content: string) { return writeFileImpl(getProjectRoot, defaultIsWithinRoot, relPath, content); }
async function renameFile(srcRel: string, dstRel: string) { return renameFileImpl(getProjectRoot, defaultIsWithinRoot, srcRel, dstRel); }
async function deleteFile(relPath: string) { return deleteFileImpl(getProjectRoot, defaultIsWithinRoot, relPath); }
async function searchFiles(query: string, relPath = '.') { return searchFilesImpl(getProjectRoot, defaultIsWithinRoot, query, relPath); }

export const fileTools = {
  setProjectRoot,
  
  readFiles,
  listFiles,
  writeFile,
  renameFile,
  deleteFile,
  searchFiles, 
};

export type FileTools = typeof fileTools;

// New: create per-run, project-root scoped tools (thread-safe)
export function createFileTools(projectRoot: string) {
  let ROOT = path.resolve(projectRoot || process.cwd());
  const getRoot = () => ROOT;
  const isWithinRoot = isWithinRootFactory(getRoot);
  return {
    setProjectRoot: (p: string) => { ROOT = path.resolve(p || ROOT); },
    readFiles: (pathsRel: string[]) => readFilesImpl(getRoot, isWithinRoot, pathsRel),
    listFiles: (relPath: string) => listFilesImpl(getRoot, isWithinRoot, relPath),
    writeFile: (relPath: string, content: string) => writeFileImpl(getRoot, isWithinRoot, relPath, content),
    renameFile: (srcRel: string, dstRel: string) => renameFileImpl(getRoot, isWithinRoot, srcRel, dstRel),
    deleteFile: (relPath: string) => deleteFileImpl(getRoot, isWithinRoot, relPath),
    searchFiles: (query: string, relPath = '.') => searchFilesImpl(getRoot, isWithinRoot, query, relPath),
  } as FileTools;
}
