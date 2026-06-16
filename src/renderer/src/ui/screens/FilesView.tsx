import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useFiles } from 'thefactory-ui/headless'
import {
  Alert,
  Button,
  FileTree,
  Input,
  Tooltip,
  arrayBufferToBase64,
  detectUploadEncoding,
  type FileTreeEntry,
} from 'thefactory-ui/web'
import { IconArrowLeftMini, IconChevron, IconUpload } from 'thefactory-ui/web/icons'

import FilePaneConnected from '@ui/components/files/FilePaneConnected'
import { LoadingScreen } from 'thefactory-ui/web'

const FILES_PANE_COLLAPSED_KEY = 'files-pane-collapsed'

export default function FilesView() {
  const {
    isLoaded,
    loadError,
    files,
    paths,
    selectedPath,
    selectFile,
    uploadFile,
    refresh,
    renameFolder,
    deleteFolder,
  } = useFiles()
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId } = useParams<{ projectId: string }>()
  const [filter, setFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [paneCollapsed, setPaneCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(FILES_PANE_COLLAPSED_KEY) === '1'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(FILES_PANE_COLLAPSED_KEY, paneCollapsed ? '1' : '0')
  }, [paneCollapsed])

  const urlFilePath = useMemo(() => {
    if (!projectId) return null
    const prefix = `/projects/${projectId}/files/`
    if (!location.pathname.startsWith(prefix)) return null
    const tail = location.pathname.slice(prefix.length)
    if (tail.length === 0) return null
    return tail.split('/').map(decodeURIComponent).join('/')
  }, [projectId, location.pathname])

  // Drop both the URL tail and the in-context selection synchronously when
  // the active project changes. A selected file from project A must NOT
  // carry over to project B just because the two happen to share a
  // same-named file. `useLayoutEffect` commits the clear before any
  // child useEffect runs, so the URL → selectFile sync below sees a
  // cleared URL and bails. Mirrors the same fix in overseer-web FilesView.
  const prevProjectIdRef = useRef(projectId)
  useLayoutEffect(() => {
    if (prevProjectIdRef.current === projectId) return
    prevProjectIdRef.current = projectId
    if (!projectId) return
    selectFile(null)
    if (urlFilePath !== null) {
      navigate(`/projects/${projectId}/files`, { replace: true })
    }
  }, [projectId, urlFilePath, navigate, selectFile])

  useEffect(() => {
    if (selectedPath !== urlFilePath) selectFile(urlFilePath)
  }, [urlFilePath, selectedPath, selectFile])

  useEffect(() => {
    if (!isLoaded || !projectId || !urlFilePath) return
    if (paths.length === 0) return
    if (!paths.includes(urlFilePath)) {
      navigate(`/projects/${projectId}/files`, { replace: true })
    }
  }, [isLoaded, projectId, urlFilePath, paths, navigate])

  const onSelect = (path: string | null) => {
    selectFile(path)
    if (!projectId) return
    if (path === null) {
      navigate(`/projects/${projectId}/files`)
      return
    }
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    navigate(`/projects/${projectId}/files/${encoded}`)
  }

  const treeEntries = useMemo<FileTreeEntry[]>(
    () =>
      files.map((f) => ({
        relativePath: f.relativePath ?? f.absolutePath,
        name: f.name,
        type: f.type ?? f.ext ?? null,
      })),
    [files],
  )

  if (!isLoaded) return <LoadingScreen label="Loading files…" />
  if (loadError) return <LoadingScreen label="Could not load files" error={loadError.message} />

  const onUploadClick = () => fileInputRef.current?.click()

  const onFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const encoding = detectUploadEncoding(file)
      const body =
        encoding === 'text'
          ? { content: await file.text() }
          : { contentBase64: arrayBufferToBase64(await file.arrayBuffer()) }
      const uploadedPath = await uploadFile(file.name, body)
      await refresh()
      onSelect(uploadedPath)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex w-full h-full overflow-hidden">
      <aside
        className="shrink-0 flex flex-col border-r overflow-hidden transition-[width]"
        style={{
          width: paneCollapsed ? 48 : '33%',
          minWidth: paneCollapsed ? 48 : 280,
          maxWidth: paneCollapsed ? 48 : 520,
          borderColor: 'var(--border-subtle)',
          background: 'var(--surface-base)',
        }}
      >
        <div
          className={`flex items-center gap-2 px-2 py-2 shrink-0 ${
            paneCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!paneCollapsed && (
            <Input
              placeholder="Filter files…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              size="sm"
              className="flex-1"
            />
          )}
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setPaneCollapsed((v) => !v)}
            aria-label={paneCollapsed ? 'Expand files pane' : 'Collapse files pane'}
            title={paneCollapsed ? 'Expand files pane' : 'Collapse files pane'}
          >
            <IconChevron
              className="w-4 h-4"
              style={{ transform: paneCollapsed ? undefined : 'rotate(180deg)' }}
            />
          </Button>
        </div>
        {!paneCollapsed && (
          <>
            <div
              className="flex items-center justify-between gap-2 px-3 py-2 border-b shrink-0"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <span className="text-xs text-(--text-muted)">
                {paths.length} file{paths.length === 1 ? '' : 's'}
              </span>
              <Tooltip content="Upload file">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={onUploadClick}
                  disabled={uploading}
                  aria-label="Upload file"
                >
                  <IconUpload className="w-4 h-4" />
                </Button>
              </Tooltip>
              <input ref={fileInputRef} type="file" hidden onChange={onFilePicked} />
            </div>
            {uploadError && (
              <div className="px-3 py-2 shrink-0">
                <Alert>{uploadError}</Alert>
              </div>
            )}
            <div className="flex-1 overflow-auto px-1 py-1">
              <FileTree
                files={treeEntries}
                selectedPath={selectedPath}
                query={filter}
                onSelectFile={onSelect}
                onRenameFolder={renameFolder}
                onDeleteFolder={deleteFolder}
              />
            </div>
          </>
        )}
      </aside>

      <main className="flex flex-col flex-1 min-w-0">
        {selectedPath && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="md:hidden flex items-center gap-1 px-3 py-2 text-xs border-b shrink-0"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <IconArrowLeftMini className="w-3 h-3" /> Back to files
          </button>
        )}
        <div className="flex-1 min-h-0 overflow-hidden">
          <FilePaneConnected />
        </div>
      </main>
    </div>
  )
}
