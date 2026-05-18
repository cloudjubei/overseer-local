import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  deleteFiles,
  getAllFileStats,
  readFile,
  readFilePaths,
  renameFiles,
  uploadFile,
  writeFile,
  type FileMeta,
  type FilesResult,
} from '../../generated/backend'
import { classifyFileByExtension } from 'thefactory-ui/web'
import { useApi } from './ApiContext'
import { useActiveProject } from './ProjectsContext'

export type FilesContextValue = {
  /** True once the first file-list fetch for the active project has completed. */
  isLoaded: boolean
  /** Last list fetch error; cleared on the next successful refresh. */
  loadError: Error | null

  /** Flat list of relative paths for every project file (recursive, files only). */
  paths: string[]
  /** Full per-file metadata for every project file (recursive, files only). */
  files: FileMeta[]

  /** Currently-selected file path, or `null`. */
  selectedPath: string | null
  /** Content of the selected file, or `null` while loading / none selected. */
  content: string | null
  /** True while fetching content for `selectedPath`. */
  isContentLoading: boolean
  /** Error from the last content fetch, cleared when a new one succeeds. */
  contentError: Error | null

  selectFile: (path: string | null) => void

  /** Returns the unified diff produced by the backend. */
  writeFile: (path: string, content: string) => Promise<string>
  /**
   * Upload a file. Pass either text `content` or base64-encoded
   * `contentBase64` for binary payloads — exactly one. The backend rejects
   * the request when neither or both are present.
   */
  uploadFile: (
    name: string,
    body: { content: string } | { contentBase64: string },
  ) => Promise<string>
  deleteFiles: (paths: string[]) => Promise<void>
  renameFile: (from: string, to: string) => Promise<void>

  /**
   * Read several files in one request. Returns a `FilesResult` keyed by
   * the requested path; values are `string` (when `lineNumbers === false`)
   * or `Array<string>` (one entry per line, prefixed with the line number)
   * when `lineNumbers === true`.
   */
  readPaths: (paths: string[], opts?: { lineNumbers?: boolean }) => Promise<FilesResult>

  refresh: () => Promise<void>
}

const FilesContext = createContext<FilesContextValue | null>(null)

export function FilesProvider({ children }: { children: ReactNode }) {
  const { ws } = useApi()
  const { projectId } = useActiveProject()

  const [files, setFiles] = useState<FileMeta[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [isContentLoading, setIsContentLoading] = useState(false)
  const [contentError, setContentError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) {
      setFiles([])
      setIsLoaded(true)
      setLoadError(null)
      return
    }
    try {
      const { data } = await getAllFileStats({ path: { projectId }, throwOnError: true })
      setFiles(data)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoaded(true)
    }
  }, [projectId])

  useEffect(() => {
    setIsLoaded(false)
    setFiles([])
    setSelectedPath(null)
    setContent(null)
    setLoadError(null)
    setContentError(null)
    void refresh()
  }, [projectId, refresh])

  const paths = useMemo<string[]>(
    () => files.map((f) => f.relativePath ?? f.absolutePath).filter(Boolean) as string[],
    [files],
  )

  useEffect(() => ws.on('files:changed', () => void refresh()), [ws, refresh])

  // Fetch content whenever the selected path changes (or after a write, via refresh).
  useEffect(() => {
    // Clear synchronously so consumers don't render the previous file's
    // content under the new header during the in-flight fetch.
    setContent(null)
    setContentError(null)
    if (!projectId || !selectedPath) {
      return
    }
    // Images / PDFs / unknown binaries go through the raw-bytes endpoint
    // (consumers fetch a blob URL). Skip the text read so we don't surface
    // a decode error in the FilePane's text branch for binary clicks.
    const kind = classifyFileByExtension(selectedPath)
    if (kind !== 'markdown' && kind !== 'html' && kind !== 'text') {
      return
    }
    let cancelled = false
    setIsContentLoading(true)
    readFile({
      path: { projectId },
      body: { path: selectedPath },
      throwOnError: true,
    })
      .then(({ data }) => {
        if (cancelled) return
        setContent(data.content)
        setContentError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setContent(null)
        setContentError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setIsContentLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, selectedPath])

  const requireProject = useCallback(() => {
    if (!projectId) throw new Error('No active project — cannot perform file operation')
    return projectId
  }, [projectId])

  const writeFileImpl = useCallback(
    async (path: string, next: string): Promise<string> => {
      const id = requireProject()
      const { data } = await writeFile({
        path: { projectId: id },
        body: { path, content: next },
        throwOnError: true,
      })
      await refresh()
      if (selectedPath === path) setContent(next)
      return data.diff
    },
    [requireProject, refresh, selectedPath],
  )

  const uploadFileImpl = useCallback<FilesContextValue['uploadFile']>(
    async (name, body) => {
      const id = requireProject()
      const { data } = await uploadFile({
        path: { projectId: id },
        body: { name, ...body },
        throwOnError: true,
      })
      await refresh()
      return data.path
    },
    [requireProject, refresh],
  )

  const deleteFilesImpl = useCallback(
    async (toDelete: string[]) => {
      const id = requireProject()
      await deleteFiles({
        path: { projectId: id },
        body: { paths: toDelete },
        throwOnError: true,
      })
      if (selectedPath && toDelete.includes(selectedPath)) setSelectedPath(null)
      await refresh()
    },
    [requireProject, refresh, selectedPath],
  )

  const renameFileImpl = useCallback(
    async (from: string, to: string) => {
      const id = requireProject()
      await renameFiles({
        path: { projectId: id },
        body: { moves: [{ src: from, dst: to }] },
        throwOnError: true,
      })
      if (selectedPath === from) setSelectedPath(to)
      await refresh()
    },
    [requireProject, refresh, selectedPath],
  )

  const readPathsImpl = useCallback<FilesContextValue['readPaths']>(
    async (pathsToRead, opts) => {
      const id = requireProject()
      const { data } = await readFilePaths({
        path: { projectId: id },
        body: {
          paths: pathsToRead,
          ...(opts?.lineNumbers ? { lineNumbers: true } : {}),
        },
        throwOnError: true,
      })
      return data
    },
    [requireProject],
  )

  const value = useMemo<FilesContextValue>(
    () => ({
      isLoaded,
      loadError,
      paths,
      files,
      selectedPath,
      content,
      isContentLoading,
      contentError,
      selectFile: setSelectedPath,
      writeFile: writeFileImpl,
      uploadFile: uploadFileImpl,
      deleteFiles: deleteFilesImpl,
      renameFile: renameFileImpl,
      readPaths: readPathsImpl,
      refresh,
    }),
    [
      isLoaded,
      loadError,
      paths,
      files,
      selectedPath,
      content,
      isContentLoading,
      contentError,
      writeFileImpl,
      uploadFileImpl,
      deleteFilesImpl,
      renameFileImpl,
      readPathsImpl,
      refresh,
    ],
  )

  return <FilesContext.Provider value={value}>{children}</FilesContext.Provider>
}

export function useFiles(): FilesContextValue {
  const ctx = useContext(FilesContext)
  if (!ctx) throw new Error('useFiles must be used within FilesProvider')
  return ctx
}
