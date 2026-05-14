import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  Alert,
  Button,
  classifyFileByExtension,
  FilePane,
  FileTree,
  Input,
  Tooltip,
  type FileTreeEntry,
} from 'thefactory-ui/web'
import { IconChevron, IconUpload } from 'thefactory-ui/web/icons'

import { useFiles } from '../contexts/FilesContext'
import { goToFile, parseFileFromHash } from '../navigation/FilesNavigation'

const FILES_PANE_COLLAPSED_KEY = 'files-pane-collapsed'

function mimeTypeFor(path: string): string {
  const lastDot = path.lastIndexOf('.')
  if (lastDot === -1) return 'application/octet-stream'
  const ext = path.slice(lastDot).toLowerCase()
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.pdf': 'application/pdf',
  }
  return map[ext] ?? 'application/octet-stream'
}

export const FilesView: React.FC = () => {
  const { files, readFile, writeFile, renameFile, deleteFile, uploadFile } = useFiles()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [paneCollapsed, setPaneCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(FILES_PANE_COLLAPSED_KEY) === '1'
  })

  const [content, setContent] = useState<string | null>(null)
  const [isContentLoading, setIsContentLoading] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(FILES_PANE_COLLAPSED_KEY, paneCollapsed ? '1' : '0')
  }, [paneCollapsed])

  useEffect(() => {
    function syncFromHash() {
      setSelectedPath(parseFileFromHash())
    }
    window.addEventListener('hashchange', syncFromHash)
    syncFromHash()
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const selectedMeta = useMemo(
    () => (selectedPath ? files.find((f) => f.relativePath === selectedPath) : undefined),
    [files, selectedPath],
  )

  useEffect(() => {
    setContent(null)
    setContentError(null)
    if (!selectedPath) return
    // Images / PDFs / unknown binaries go through `getBinaryUrl` instead of
    // the text read; skip the utf-8 fetch (and the bogus error it would
    // surface for binary content).
    const kind = classifyFileByExtension(selectedPath)
    if (kind !== 'markdown' && kind !== 'html' && kind !== 'text') return

    let cancelled = false
    setIsContentLoading(true)
    readFile(selectedPath, 'utf8')
      .then((txt) => {
        if (cancelled) return
        setContent(txt ?? '')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setContentError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setIsContentLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedPath, readFile])

  const treeEntries = useMemo<FileTreeEntry[]>(
    () =>
      files.map((f) => ({
        relativePath: f.relativePath ?? f.absolutePath,
        name: f.name,
        type: f.type ?? f.ext ?? null,
      })),
    [files],
  )

  const getBinaryUrl = useCallback(
    async (path: string) => {
      const base64 = await readFile(path, 'base64')
      if (base64 == null) throw new Error('Failed to read file')
      return `data:${mimeTypeFor(path)};base64,${base64}`
    },
    [readFile],
  )

  const onWrite = useCallback(
    async (path: string, next: string) => {
      await writeFile(path, next)
    },
    [writeFile],
  )

  const onRename = useCallback(
    async (from: string, to: string) => {
      await renameFile(from, to)
      goToFile(to)
    },
    [renameFile],
  )

  const onDelete = useCallback(
    async (path: string) => {
      await deleteFile(path)
      goToFile('')
    },
    [deleteFile],
  )

  const onUploadClick = () => fileInputRef.current?.click()
  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const text = await file.text()
      const uploaded = await uploadFile(file.name, text)
      if (uploaded) goToFile(uploaded)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-row w-full h-full overflow-hidden">
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
                {files.length} file{files.length === 1 ? '' : 's'}
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
                query={query}
                onSelectFile={(p) => goToFile(p)}
              />
            </div>
          </>
        )}
      </aside>

      <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
        <FilePane
          filePath={selectedPath}
          fileName={selectedMeta?.name}
          fileSize={selectedMeta?.size ?? null}
          content={content}
          isContentLoading={isContentLoading}
          contentError={contentError}
          onWrite={onWrite}
          onRename={onRename}
          onDelete={onDelete}
          getBinaryUrl={getBinaryUrl}
          fileInfo={
            selectedMeta
              ? {
                  path: selectedMeta.relativePath ?? undefined,
                  absolutePath: selectedMeta.absolutePath ?? undefined,
                  size: selectedMeta.size ?? null,
                  type: selectedMeta.type ?? null,
                  ext: selectedMeta.ext ?? null,
                  mtime: selectedMeta.mtime ?? null,
                  ctime: selectedMeta.ctime ?? null,
                }
              : undefined
          }
        />
      </main>
    </div>
  )
}

export default FilesView
