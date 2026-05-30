import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { GitDiffSummary, GitFileChange, GitLogCommit } from 'thefactory-ui/headless/api'
import {
  Alert,
  DiffViewer,
  GitFileChangesPills,
  GitFileStatusIcon,
  PathDisplay,
  ResizeHandle,
  Spinner,
  getFilePatch,
  useLocalStorageNumber,
  type IntraMode,
} from 'thefactory-ui/web'
import { EMPTY_TREE_SHA } from 'thefactory-tools/constants'

/**
 * Fetches the file-level diff between two refs. Caller-supplied so the
 * same viewer renders a project commit, an overseer commit, or any
 * future repo scope without baking the SDK path in here.
 */
export type CommitDiffFetcher = (
  input: { baseRef: string; headRef: string; includePatch: boolean },
  signal: AbortSignal,
) => Promise<GitDiffSummary>

export type CommitDiffViewerProps = {
  commitSha: string
  /**
   * Loaded log for parent-SHA lookup. The root commit has no parent — we
   * fall back to git's empty-tree SHA so the diff renders every file as
   * added rather than 500ing on a bad-ref `<sha>^`.
   */
  log: GitLogCommit[]
  fetcher: CommitDiffFetcher
}

const LEFT_WIDTH_KEY = 'CommitDiffViewer.leftWidthPx'

/**
 * One row in the file list. Memoised so a selection change in a commit
 * with thousands of files only re-renders the two affected rows (newly-
 * selected and previously-selected) instead of the whole list. Custom
 * `arePropsEqual` makes the comparison cheap: stable identities on the
 * file object, the memoised patch reference, the stable click handler.
 */
type FileRowProps = {
  file: GitFileChange
  patch: string
  isSelected: boolean
  onSelect: (path: string) => void
}

const FileRow = memo(
  function FileRow({ file, patch, isSelected, onSelect }: FileRowProps) {
    return (
      <button
        type="button"
        onClick={() => onSelect(file.path)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs ${
          isSelected
            ? 'bg-sky-50 dark:bg-sky-900/25 text-sky-900 dark:text-sky-100'
            : 'hover:bg-(--surface-muted)'
        }`}
        title={file.path}
      >
        <GitFileStatusIcon status={file.status} className="w-3.5 h-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          <PathDisplay path={file.path} />
        </span>
        <GitFileChangesPills patch={patch} />
      </button>
    )
  },
  (a, b) =>
    a.file === b.file &&
    a.patch === b.patch &&
    a.isSelected === b.isSelected &&
    a.onSelect === b.onSelect,
)

/**
 * Read-only diff for a single commit or stash — fetched via the supplied
 * `fetcher` (typically `getGitBranchDiffSummary({ baseRef: "<sha>^",
 * headRef: "<sha>" })`). File list on the left, the rich `DiffViewer` on
 * the right with wrap/ignoreWS/intra-line toggles.
 */
export default function CommitDiffViewer({ commitSha, log, fetcher }: CommitDiffViewerProps) {
  const [summary, setSummary] = useState<GitDiffSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  // Resizable file-list column — persists across sessions like desktop.
  const [leftWidth, setLeftWidth] = useLocalStorageNumber(LEFT_WIDTH_KEY, 300)
  const onLeftResizeStart = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = leftWidth
    const onMove = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - startX
      setLeftWidth(Math.max(150, Math.min(800, startW + dx)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // DiffViewer interactive options
  const [wrap, setWrap] = useState(false)
  const [ignoreWS, setIgnoreWS] = useState(false)
  const [intra, setIntra] = useState<IntraMode>('word')

  const lastReqRef = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!commitSha || commitSha === 'UNCOMMITTED') return
    lastReqRef.current?.abort()
    const controller = new AbortController()
    lastReqRef.current = controller
    setLoading(true)
    setError(null)
    setSummary(null)
    setSelectedPath(null)
    const found = log.find((c) => c.hash === commitSha)
    const baseRef = found ? (found.parents?.[0] ?? EMPTY_TREE_SHA) : `${commitSha}^`
    fetcher({ baseRef, headRef: commitSha, includePatch: true }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setSummary(data)
        setSelectedPath(data.files[0]?.path ?? null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to load commit diff')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [commitSha, log, fetcher])

  // Memoise per-file patches once per loaded summary. `getFilePatch` scans
  // the entire combined `summary.patch` to find a file's section, so
  // calling it inline for every row turns into O(n · |patch|) work on
  // every render — devastating for commits with thousands of files when
  // a row click forces the list to re-render. The Map is computed once
  // and reused across renders + handed to memoised rows as a stable
  // string reference per path.
  const patchByPath = useMemo(() => {
    const m = new Map<string, string>()
    if (!summary) return m
    const combined = summary.patch ?? ''
    for (const f of summary.files) {
      m.set(f.path, f.patch || getFilePatch(combined, f.path) || '')
    }
    return m
  }, [summary])

  const onSelectFile = useCallback((path: string) => setSelectedPath(path), [])

  if (commitSha === 'UNCOMMITTED') return null
  if (loading) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm opacity-70">
        <Spinner /> Loading commit diff…
      </div>
    )
  }
  if (error) return <Alert>{error}</Alert>
  if (!summary) return null

  const activeFile = summary.files.find((f) => f.path === selectedPath) ?? summary.files[0]
  const filePatch = activeFile ? (patchByPath.get(activeFile.path) ?? '') : ''

  return (
    <div className="flex flex-row min-h-0 h-full bg-(--surface-base)">
      {/* Left: file list */}
      <div
        className="shrink-0 flex flex-col border-r border-(--border-subtle) overflow-hidden"
        style={{ width: leftWidth }}
      >
        <div className="bg-(--surface-muted) px-3 py-2 border-b border-(--border-subtle) text-xs font-semibold text-(--text-secondary) uppercase tracking-wide flex justify-between items-center shrink-0">
          <span>Files ({summary.files.length})</span>
          <GitFileChangesPills additions={summary.insertions} deletions={summary.deletions} />
        </div>
        <div className="flex-1 min-h-0 overflow-auto divide-y divide-(--border-subtle)">
          {summary.files.length === 0 ? (
            <div className="px-3 py-2 text-xs text-(--text-muted) italic">
              No file changes in this commit.
            </div>
          ) : (
            summary.files.map((file) => (
              <FileRow
                key={file.path}
                file={file}
                patch={patchByPath.get(file.path) ?? ''}
                isSelected={file.path === activeFile?.path}
                onSelect={onSelectFile}
              />
            ))
          )}
        </div>
      </div>

      <ResizeHandle orientation="vertical" onResizeStart={onLeftResizeStart} />

      {/* Right: rich diff viewer */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {activeFile ? (
          <DiffViewer
            path={activeFile.path}
            patch={filePatch}
            wrap={wrap}
            ignoreWS={ignoreWS}
            intra={intra}
            onWrapChange={setWrap}
            onIgnoreWSChange={setIgnoreWS}
            onIntraChange={setIntra}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-(--text-muted)">
            Select a file to see its diff.
          </div>
        )}
      </div>
    </div>
  )
}
