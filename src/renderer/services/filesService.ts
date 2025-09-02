import { ServiceResult } from './serviceResult';

export type FileMeta = {
  path: string; // project-relative path
  name: string;
  ext?: string;
  size: number; // bytes
  mtime: number; // epoch ms
  type?: string; // mime-like string if known
};

export type FilesService = {
  subscribe: (callback: (files: FileMeta[]) => void) => () => void
  listFiles: (projectId: string) => Promise<FileMeta[]>
  readFile: (projectId: string, relPath: string, encoding?: string) => Promise<string>
  readFileBinary: (projectId: string, relPath: string) => Promise<ArrayBuffer>
  readDirectory: (projectId: string, relPath: string) => Promise<string[]>
  writeFile: (projectId: string, relPath: string, content: string | Uint8Array, encoding?: string) => Promise<ServiceResult>
  deleteFile: (projectId: string, relPath: string) => Promise<ServiceResult>
  renameFile: (projectId: string, relPathSource: string, relPathTarget: string) => Promise<ServiceResult>
  uploadFile: (projectId: string, name: string, content: string | Uint8Array) => Promise<string>
}

export const filesService: FilesService = { ...window.filesService }
