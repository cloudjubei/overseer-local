/*
  filesService: Isolated-world service proxy mirroring ProjectsService pattern.
  FilesManager (main) registers all handlers under centralized IPC keys; preload exposes this service.
*/

export type FileMeta = {
  path: string; // project-relative path
  name: string;
  ext?: string;
  size: number; // bytes
  mtime: number; // epoch ms
  type?: string; // mime-like string if known
};

export type FilesIndexSnapshot = {
  root: string
  filesDir: string
  updatedAt: string | null
  files: FileMeta[]
  errors: any[]
  metrics: { lastScanMs: number; lastScanCount: number }
}

export type ServiceResult = { ok: boolean; error?: string; details?: any }

export type FilesService = {
  // subscribe to updates (receives full snapshot)
  subscribe: (callback: (snapshot: FilesIndexSnapshot) => void) => () => void
  // get current snapshot
  get: () => Promise<FilesIndexSnapshot>
  // context switching
  setContext: (projectId: string) => Promise<FilesIndexSnapshot>
  // fs ops
  readFile: (relPath: string, encoding?: string) => Promise<string | ArrayBuffer>
  readFileBinary: (relPath: string) => Promise<ArrayBuffer>
  writeFile: (relPath: string, content: string | Uint8Array, encoding?: string) => Promise<ServiceResult>
  deleteFile: (relPath: string) => Promise<ServiceResult>
  renameFile: (relPathSource: string, relPathTarget: string) => Promise<ServiceResult>
  ensureDir: (relPath: string) => Promise<ServiceResult>
  upload: (name: string, content: string | Uint8Array) => Promise<string>
}

export const filesService: FilesService = (window as any).filesService

export default filesService
