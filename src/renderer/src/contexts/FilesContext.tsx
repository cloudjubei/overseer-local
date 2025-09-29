import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { filesService } from '../services/filesService'
import { useActiveProject } from '../contexts/ProjectContext'
import { FileMeta } from 'thefactory-tools'

export type DirNode = {
  name: string
  relPath: string
  dirs: DirNode[]
  files: FileMeta[]
}

function buildDirTree(files: FileMeta[]): DirNode {
  const root: DirNode = { name: '', relPath: '', dirs: [], files: [] }
  const dirMap = new Map<string, DirNode>()
  dirMap.set('', root)

  function ensureDir(relPath: string): DirNode {
    const existing = dirMap.get(relPath)
    if (existing) return existing
    const parts = relPath.split('/').filter(Boolean)
    const name = parts[parts.length - 1] || ''
    const parentPath = parts.slice(0, -1).join('/')
    const parent = ensureDir(parentPath)
    const node: DirNode = { name, relPath, dirs: [], files: [] }
    parent.dirs.push(node)
    dirMap.set(relPath, node)
    return node
  }

  for (const f of files) {
    const path = f.relativePath || f.absolutePath || f.name
    const parts = path.split('/')
    const fileName = parts.pop() || f.name
    const dirPath = parts.join('/')
    const dirNode = ensureDir(dirPath)
    const meta: FileMeta = { ...f, name: fileName }
    dirNode.files.push(meta)
  }

  const sortTree = (node: DirNode) => {
    node.dirs.sort((a, b) => a.name.localeCompare(b.name))
    node.files.sort((a, b) => a.name.localeCompare(b.name))
    node.dirs.forEach(sortTree)
  }
  sortTree(root)

  return root
}

export type FilesContextValue = {
  files: FileMeta[]
  filesByPath: Record<string, FileMeta>
  directoryTree: DirNode | null
  readFile: (path: string) => Promise<string | undefined>
  writeFile: (path: string, content: string) => Promise<void>
  uploadFile: (name: string, content: string) => Promise<string | undefined>
}

const FilesContext = createContext<FilesContextValue | null>(null)

export function FilesProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useActiveProject()

  const [files, setFiles] = useState<FileMeta[]>([])
  const [filesByPath, setFilesByPath] = useState<Record<string, FileMeta>>({})
  const [directoryTree, setDirectoryTree] = useState<DirNode | null>(null)

  const update = async () => {
    const files = await filesService.getAllFileStats(projectId)
    updateCurrentFiles(files)
  }
  const updateCurrentFiles = (files: FileMeta[]) => {
    setFiles(files)
    const newTree = buildDirTree(files)
    setDirectoryTree(newTree)
    let newFilesByPath: Record<string, FileMeta> = {}
    for (const f of files) {
      newFilesByPath[f.absolutePath] = f
    }
    setFilesByPath(newFilesByPath)
  }

  useEffect(() => {
    if (projectId) {
      update()
      const unsubscribe = filesService.subscribe((_) => update())
      return () => {
        unsubscribe()
      }
    }
    return
  }, [projectId])

  const readFile = async (
    path: string,
    encoding: BufferEncoding = 'utf8',
  ): Promise<string | undefined> => {
    return await filesService.readFile(projectId, path, encoding)
  }
  const writeFile = async (path: string, content: string): Promise<void> => {
    await filesService.writeFile(projectId, path, content)
  }

  const uploadFile = async (name: string, content: string): Promise<string | undefined> => {
    return await filesService.uploadFile(projectId, name, content)
  }

  const value = useMemo<FilesContextValue>(
    () => ({
      files,
      directoryTree,
      readFile,
      writeFile,
      filesByPath,
      uploadFile,
    }),
    [files, directoryTree, readFile, writeFile, filesByPath, uploadFile],
  )

  return <FilesContext.Provider value={value}>{children}</FilesContext.Provider>
}

export function useFiles(): FilesContextValue {
  const ctx = useContext(FilesContext)
  if (!ctx) throw new Error('useFiles must be used within FilesProvider')
  return ctx
}
