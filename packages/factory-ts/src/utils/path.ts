import path from 'node:path';
import fs from 'node:fs';

export function normalizeAbsolute(p: string): string {
  return path.resolve(p);
}

export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

export function ensureDirExists(dir: string, label: string): void {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`${label} does not exist or is not a directory: ${dir}`);
  }
}

export function ensureFileExists(file: string, label: string): void {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`${label} does not exist or is not a file: ${file}`);
  }
}

export function findRootDir(startDir: string): string {
  // Priority: explicit env, then search upward for 'projects' directory
  const envRoot = process.env.FACTORY_ROOT;
  if (envRoot && envRoot.trim()) {
    return normalizeAbsolute(envRoot);
  }
  let current = normalizeAbsolute(startDir);
  const { root } = path.parse(current);
  while (true) {
    const projectsPath = path.join(current, 'projects');
    if (fs.existsSync(projectsPath) && fs.statSync(projectsPath).isDirectory()) {
      return current;
    }
    if (current === root) break;
    current = path.dirname(current);
  }
  // Fallback to CWD if no 'projects' found
  return normalizeAbsolute(startDir);
}

export function joinAndNormalize(...parts: string[]): string {
  return normalizeAbsolute(path.join(...parts));
}
