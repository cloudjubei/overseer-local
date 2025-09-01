import { ProjectSpec } from "src/types/tasks";
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
  listFiles: (project: ProjectSpec) => Promise<FileMeta[]>
  readFile: (project: ProjectSpec, relPath: string, encoding?: string) => Promise<string>
  readFileBinary: (project: ProjectSpec, relPath: string) => Promise<ArrayBuffer>
  readDirectory: (project: ProjectSpec, relPath: string) => Promise<string[]>
  writeFile: (project: ProjectSpec, relPath: string, content: string | Uint8Array, encoding?: string) => Promise<ServiceResult>
  deleteFile: (project: ProjectSpec, relPath: string) => Promise<ServiceResult>
  renameFile: (project: ProjectSpec, relPathSource: string, relPathTarget: string) => Promise<ServiceResult>
  uploadFile: (project: ProjectSpec, name: string, content: string | Uint8Array) => Promise<string>
}

export const filesService: FilesService = { ...window.filesService }
