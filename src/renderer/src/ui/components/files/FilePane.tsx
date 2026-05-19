import { useCallback } from 'react'
import { useParams } from 'react-router-dom'

import { useFiles } from '@core/contexts/FilesContext'
import { useAuth } from '@core/contexts/AuthContext'
import { FilePane as FilePaneBase } from 'thefactory-ui/web'

async function fetchFileBlobUrl(
  baseUrl: string,
  projectId: string,
  path: string,
  token: string | null,
): Promise<string> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/projects/${encodeURIComponent(projectId)}/files/raw?path=${encodeURIComponent(path)}`
  const r = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!r.ok) throw new Error(`Failed to load file (${r.status})`)
  const blob = await r.blob()
  return URL.createObjectURL(blob)
}

export default function FilePane() {
  const {
    selectedPath,
    files,
    content,
    isContentLoading,
    contentError,
    writeFile,
    renameFile,
    deleteFiles,
  } = useFiles()
  const { token, baseUrl } = useAuth()
  const { projectId } = useParams<{ projectId: string }>()

  const meta = files.find((f) => f.relativePath === selectedPath)

  const getBinaryUrl = useCallback(
    async (path: string) => {
      if (!projectId) throw new Error('No active project')
      if (!baseUrl) throw new Error('No backend URL configured')
      return fetchFileBlobUrl(baseUrl, projectId, path, token)
    },
    [baseUrl, projectId, token],
  )

  const onWrite = useCallback(
    async (path: string, next: string) => {
      await writeFile(path, next)
    },
    [writeFile],
  )

  const onDelete = useCallback(
    async (path: string) => {
      await deleteFiles([path])
    },
    [deleteFiles],
  )

  return (
    <FilePaneBase
      filePath={selectedPath}
      fileName={meta?.name}
      fileSize={meta?.size ?? null}
      content={content}
      isContentLoading={isContentLoading}
      contentError={contentError?.message ?? null}
      onWrite={onWrite}
      onRename={renameFile}
      onDelete={onDelete}
      getBinaryUrl={getBinaryUrl}
      revokeBinaryUrl={(url) => URL.revokeObjectURL(url)}
      fileInfo={
        meta
          ? {
              path: meta.relativePath ?? undefined,
              absolutePath: meta.absolutePath ?? undefined,
              size: meta.size ?? null,
              type: meta.type ?? null,
              ext: meta.ext ?? null,
              mtime: meta.mtime ?? null,
              ctime: meta.ctime ?? null,
            }
          : undefined
      }
    />
  )
}
