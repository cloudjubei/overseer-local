import { useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { FILE_LINE_PARAM, fileLineParam, useFiles } from 'thefactory-ui/headless'
import { useAuth } from '@core/contexts/AuthContext'
import { FilePane as FilePaneBase } from 'thefactory-ui/web'

import { fetchFileBinaryUrl, revokeFileBinaryUrl } from '@services/fileBinaryService'

export default function FilePaneConnected(): React.JSX.Element {
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
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const focusLine = fileLineParam(params.get(FILE_LINE_PARAM))

  const meta = files.find((f) => f.relativePath === selectedPath)

  const getBinaryUrl = useCallback(
    async (path: string) => {
      if (!projectId) throw new Error('No active project')
      if (!baseUrl) throw new Error('No backend URL configured')
      return fetchFileBinaryUrl(baseUrl, projectId, path, token)
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
      if (projectId) navigate(`/projects/${projectId}/files`, { replace: true })
      await deleteFiles([path])
    },
    [deleteFiles, navigate, projectId],
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
      {...(focusLine !== undefined ? { focusLine } : {})}
      revokeBinaryUrl={revokeFileBinaryUrl}
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
