import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useActiveProject } from '@core/contexts/ProjectsContext'
import { useGit } from '@core/contexts/GitContext'
import { getGitBranchDiffSummary } from 'thefactory-ui/headless/api'
import type { GitDiffSummary } from 'thefactory-ui/headless/api'
import {
  Alert,
  DiffViewer,
  GitFileChangesPills,
  GitFileStatusIcon,
  PathDisplay,
  ResizeHandle,
  Spinner,
  getFilePatch,
  type IntraMode,
} from 'thefactory-ui/web'
import { EMPTY_TREE_SHA } from 'thefactory-tools/constants'

export type CommitDiffViewerProps = {
  commitSha: string
}

const LEFT_WIDTH_KEY = 'CommitDiffViewer.leftWidthPx'

function readNumberLs(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(key)
    if (v === null) return fallback
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
  } catch {
    return fallback
  }
}

function writeNumberLs(key: string, n: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, String(Math.round(n)))
  } catch {
    // best-effort
  }
}

/**
 * Read-only diff for a single commit or stash — fetched via
 * `getBranchDiffSummary({ baseRef: "<sha>^", headRef: "<sha>" })`. Same
 * layout as desktop's `GitCommitChanges`: file list on the left, the rich
 * `DiffViewer` on the right with wrap/ignoreWS/intra-line toggles.
 */
export default function CommitDiffViewer({ commitSha }: CommitDiffViewerProps) {
  const { projectId } = useActiveProject()
  const { log } = useGit()
  const [summary, setSummary] = useState<GitDiffSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  // Resizable file-list column — persists across sessions like desktop.
  const [leftWidth, setLeftWidth] = useState<number>(() => readNumberLs(LEFT_WIDTH_KEY, 300))
  useEffect(() => {
    writeNumberLs(LEFT_WIDTH_KEY, leftWidth)
  }, [leftWidth])
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

  // The fetch effect aborts on commit-sha change so a quick click between
  // commits doesn't render a stale diff. Resolving `baseRef`:
  //   - For an ordinary commit, look it up in `useGit().log` and use its
  //     `parents[0]`. That also handles the **initial / root commit** (no
  //     parent) — we fall back to git's empty-tree SHA so the diff renders
  //     every file as added rather than 500ing on a bad-ref `<sha>^`.
  //   - For a stash ref (`stash@{0}`) the entry isn't in `log`, so the
  //     `<ref>^` suffix is correct (git resolves it to the working-tree
  //     parent of the stash).
  const lastReqRef = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!projectId || !commitSha || commitSha === 'UNCOMMITTED') return
    lastReqRef.current?.abort()
    const controller = new AbortController()
    lastReqRef.current = controller
    setLoading(true)
    setError(null)
    setSummary(null)
    setSelectedPath(null)
    const found = log.find((c) => c.hash === commitSha)
    const baseRef = found ? (found.parents?.[0] ?? EMPTY_TREE_SHA) : `${commitSha}^`
    getGitBranchDiffSummary({
      path: { projectId },
      body: { baseRef, headRef: commitSha, includePatch: true },
      signal: controller.signal,
      throwOnError: true,
    })
      .then(({ data }) => {
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
  }, [projectId, commitSha, log])

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
  // Some backends return per-file `patch`; others fall back to the combined
  // `summary.patch`. Splitting it per-path keeps the diff viewer focused on
  // one file at a time — matches desktop's `getFilePatch` helper.
  const filePatch = activeFile?.patch || getFilePatch(summary.patch, activeFile?.path || '')

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
            summary.files.map((file) => {
              const isSelected = file.path === activeFile?.path
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
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
                  <GitFileChangesPills
                    patch={file.patch || getFilePatch(summary.patch, file.path)}
                  />
                </button>
              )
            })
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
