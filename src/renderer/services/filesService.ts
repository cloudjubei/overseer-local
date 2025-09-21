import { FileMeta, FilesResult, FileUpdate } from 'thefactory-tools'

export type FilesService = {
  subscribe: (callback: (fileUpdate: FileUpdate) => void) => () => void
  listFiles: (projectId: string) => Promise<string[]>
  readFile: (projectId: string, relPath: string, encoding?: string) => Promise<string | undefined>
  readPaths: (projectId: string, pathsRel: string[]) => Promise<FilesResult | undefined>
  getAllFileStats: (projectId: string) => Promise<FileMeta[]>
  writeFile: (
    projectId: string,
    relPath: string,
    content: string | Buffer,
    encoding?: BufferEncoding,
  ) => Promise<void>
  renamePath: (projectId: string, srcRel: string, dstRel: string) => Promise<void>
  deletePath: (projectId: string, relPath: string) => Promise<void>
  searchFiles: (projectId: string, query: string, relPath?: string) => Promise<string[]>
  uploadFile: (projectId: string, name: string, content: string | Buffer) => Promise<string>
}

export const filesService: FilesService = { ...window.filesService }
