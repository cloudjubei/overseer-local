/*
  fileService: generic file indexing + content access with graceful fallbacks.
  Content access attempts common Electron preload bridges, else returns null.
*/

export type FileMeta = {
  path: string; // project-relative path
  name: string;
  ext?: string;
  size: number; // bytes
  mtime: number; // epoch ms
  type?: string; // mime-like string if known
};

export type FilesIndex = {
  files: FileMeta[];
  byPath: Map<string, FileMeta>;
  updatedAt: number;
};

let currentIndex: FilesIndex = {
  files: [],
  byPath: new Map(),
  updatedAt: 0,
};

const subscribers = new Set<(idx: FilesIndex) => void>();
let pollTimer: number | undefined;

function emit() {
  currentIndex.updatedAt = Date.now();
  subscribers.forEach((cb) => {
    try { cb(currentIndex); } catch {}
  });
}

function normalizeExt(name: string): string | undefined {
  const i = name.lastIndexOf(".");
  if (i <= 0) return undefined;
  return name.slice(i + 1).toLowerCase();
}

function toFileMetaLike(x: any): FileMeta | null {
  if (!x) return null;
  // Best-effort normalization across potential shapes
  const path = x.path || x.filePath || x.id || x.key;
  const name = x.name || x.filename || (typeof path === 'string' ? path.split(/[\\\/]/).pop() : undefined);
  const size = typeof x.size === 'number' ? x.size : (typeof x.bytes === 'number' ? x.bytes : 0);
  const mtime = typeof x.mtime === 'number' ? x.mtime : (x.modified || x.lastModified || 0);
  const type = x.type || x.mime || undefined;
  if (!path || !name) return null;
  return {
    path,
    name,
    ext: normalizeExt(name),
    size,
    mtime,
    type,
  };
}

function readGlobalIndex(): FileMeta[] {
  const w = window as any;
  try {
    if (w.filesIndex) {
      const fi = w.filesIndex;
      if (Array.isArray(fi)) return fi.map(toFileMetaLike).filter(Boolean) as FileMeta[];
      if (Array.isArray(fi.files)) return fi.files.map(toFileMetaLike).filter(Boolean) as FileMeta[];
      if (typeof fi.list === 'function') {
        const arr = fi.list();
        if (Array.isArray(arr)) return arr.map(toFileMetaLike).filter(Boolean) as FileMeta[];
      }
    }
  } catch (e) {
    console.warn('fileService: failed to read global index', e);
  }
  return [];
}

function rebuildIndex(files: FileMeta[]) {
  currentIndex.files = files.sort((a, b) => a.name.localeCompare(b.name));
  currentIndex.byPath = new Map(files.map((f) => [f.path, f] as const));
}

export async function refreshIndex(): Promise<FilesIndex> {
  const files = readGlobalIndex();
  rebuildIndex(files);
  emit();
  return currentIndex;
}

export async function getIndex(): Promise<FilesIndex> {
  if (!currentIndex.files.length) await refreshIndex();
  return currentIndex;
}

export function subscribe(cb: (idx: FilesIndex) => void): () => void {
  subscribers.add(cb);
  // lazy start polling loop for environments without events
  if (!pollTimer) {
    pollTimer = window.setInterval(() => {
      const latest = readGlobalIndex();
      // shallow compare length + a simple fingerprint by mtime/size
      const prev = currentIndex.files;
      if (latest.length !== prev.length || latest.some((f, i) => {
        const p = prev[i];
        return !p || p.path !== f.path || p.mtime !== f.mtime || p.size !== f.size;
      })) {
        rebuildIndex(latest);
        emit();
      }
    }, 4000);
  }
  // immediate notify
  cb(currentIndex);
  return () => {
    subscribers.delete(cb);
    if (!subscribers.size && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  };
}

// Heuristics for text-like files
const textExts = new Set([
  'txt','md','mdx','json','js','jsx','ts','tsx','css','scss','less','html','htm','xml','yml','yaml','csv','log','sh','bash','zsh','bat','ps1','py','rb','java','kt','go','rs','c','h','cpp','hpp','m','swift','ini','conf','env'
]);

export function isLikelyText(meta: FileMeta): boolean {
  if (meta.ext && textExts.has(meta.ext)) return true;
  if (meta.type) {
    if (meta.type.startsWith('text/')) return true;
    if (meta.type.includes('json') || meta.type.includes('xml')) return true;
  }
  // small files are likely safe to attempt text read
  return meta.size > 0 && meta.size < 2 * 1024 * 1024; // <2MB
}

export async function readFileText(path: string): Promise<string | null> {
  const w = window as any;
  try {
    if (w.api?.readFile) {
      const res = await w.api.readFile(path, 'utf8');
      if (typeof res === 'string') return res;
      if (res && typeof res.data === 'string') return res.data;
    }
    if (w.readFile) {
      const res = await w.readFile(path, 'utf8');
      if (typeof res === 'string') return res;
    }
    if (w.files?.readFile) {
      const res = await w.files.readFile(path, 'utf8');
      if (typeof res === 'string') return res;
    }
  } catch (e) {
    console.warn('fileService: readFileText failed', e);
  }
  return null;
}

export async function readFileBinary(path: string): Promise<ArrayBuffer | null> {
  const w = window as any;
  try {
    if (w.api?.readFileBinary) {
      const buf = await w.api.readFileBinary(path);
      if (buf && (buf as ArrayBuffer).byteLength !== undefined) return buf as ArrayBuffer;
    }
    if (w.readFileBinary) {
      const buf = await w.readFileBinary(path);
      if (buf && (buf as ArrayBuffer).byteLength !== undefined) return buf as ArrayBuffer;
    }
  } catch (e) {
    console.warn('fileService: readFileBinary failed', e);
  }
  return null;
}

export function guessLanguageFromExt(ext?: string): string | undefined {
  switch ((ext || '').toLowerCase()) {
    case 'ts': return 'typescript';
    case 'tsx': return 'tsx';
    case 'js': return 'javascript';
    case 'jsx': return 'jsx';
    case 'json': return 'json';
    case 'css': return 'css';
    case 'scss': return 'scss';
    case 'less': return 'less';
    case 'html':
    case 'htm': return 'html';
    case 'xml': return 'xml';
    case 'yml':
    case 'yaml': return 'yaml';
    case 'md':
    case 'mdx': return 'markdown';
    case 'py': return 'python';
    case 'rb': return 'ruby';
    case 'java': return 'java';
    case 'kt': return 'kotlin';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'c':
    case 'h': return 'c';
    case 'cpp':
    case 'hpp': return 'cpp';
    case 'sh':
    case 'bash':
    case 'zsh': return 'shell';
    default: return undefined;
  }
}

export function inferFileType(pathOrName: string): string {
  const i = pathOrName.lastIndexOf('.');
  if (i > 0 && i < pathOrName.length - 1) return pathOrName.slice(i + 1).toLowerCase();
  return 'unknown';
}

export function upload(name: string, content: string)
{
  //TODO: save a new file to a new folder 'uploads'
}

export default {
  getIndex,
  refreshIndex,
  subscribe,
  isLikelyText,
  readFileText,
  readFileBinary,
  guessLanguageFromExt,
  upload
};

// Named exports for convenience in existing import sites
export const fileService = {
  getIndex,
  refreshIndex,
  subscribe,
  isLikelyText,
  readFileText,
  readFileBinary,
  guessLanguageFromExt,
  upload
};
