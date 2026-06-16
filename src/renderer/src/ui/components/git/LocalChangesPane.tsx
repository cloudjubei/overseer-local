import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, MouseEvent } from 'react'
import { useGit } from 'thefactory-ui/headless'
import type { LocalDiffEntry, ChangesArea } from 'thefactory-ui/headless'
import { extractServerError } from 'thefactory-ui/headless/api'
import { mergeUnstagedWithUntracked, useLocalChangesSelection } from 'thefactory-ui/headless'
import {
  Alert,
  ConfirmDialog,
  DiffViewer,
  GitFileRow,
  ResizeHandle,
  Spinner,
  Tooltip,
  type GitLocalFileEntry,
  type IntraMode,
} from 'thefactory-ui/web'

export type LocalChangesPaneProps = {
  /** Bubbled up so the parent can mount the merge resolver modal. */
  onResolveConflict?: (filePath: string) => void
}

type Area = ChangesArea

function entryToLocalFile(entry: LocalDiffEntry): GitLocalFileEntry {
  return {
    path: entry.path,
    status: entry.status,
    patch: entry.patch,
    binary: entry.binary,
    isConflicted: entry.isConflicted,
  }
}

const LEFT_WIDTH_KEY = 'LocalChangesPane.leftWidthPx'
const STAGED_HEIGHT_KEY = 'LocalChangesPane.stagedHeightPx'

/**
 * Full working-tree pane — staged/unstaged sections with multi-select rows,
 * drag-drop staging, and an inline diff for the selected file. Mirrors
 * desktop's `GitLocalChanges` 1:1: per-section header checkbox for bulk
 * stage/unstage, resizable left pane, horizontal split between staged and
 * unstaged, and partial-patch staging via the diff viewer's apply/discard
 * callbacks.
 */
export default function LocalChangesPane({ onResolveConflict }: LocalChangesPaneProps) {
  const {
    status,
    localDiff,
    isLocalDiffLoading,
    loadLocalDiff,
    stage,
    unstage,
    discardUnstaged,
    removeFiles,
    applyPatch,
  } = useGit()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pane sizing — persisted across sessions like desktop.
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 320
    const stored = window.localStorage.getItem(LEFT_WIDTH_KEY)
    const n = stored ? parseInt(stored, 10) : NaN
    return Number.isFinite(n) && n > 0 ? n : 320
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(LEFT_WIDTH_KEY, String(Math.round(leftWidth)))
    } catch {
      // best-effort
    }
  }, [leftWidth])
  const onLeftResizeStart = (e: globalThis.PointerEvent | React.PointerEvent) => {
    e.preventDefault()
    const startX = (e as React.PointerEvent).clientX
    const startW = leftWidth
    const onMove = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - startX
      setLeftWidth(Math.max(180, Math.min(800, startW + dx)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const [stagedHeight, setStagedHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 220
    const stored = window.localStorage.getItem(STAGED_HEIGHT_KEY)
    const n = stored ? parseInt(stored, 10) : NaN
    return Number.isFinite(n) && n > 0 ? n : 220
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STAGED_HEIGHT_KEY, String(Math.round(stagedHeight)))
    } catch {
      // best-effort
    }
  }, [stagedHeight])
  const leftPaneRef = useRef<HTMLDivElement | null>(null)
  const onStagedResizeStart = (e: globalThis.PointerEvent | React.PointerEvent) => {
    e.preventDefault()
    const startY = (e as React.PointerEvent).clientY
    const startH = stagedHeight
    const onMove = (ev: globalThis.PointerEvent) => {
      const containerH = leftPaneRef.current?.clientHeight ?? window.innerHeight
      const min = 100
      const max = Math.max(min, containerH - 100)
      setStagedHeight(Math.max(min, Math.min(max, startH + ev.clientY - startY)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const [dragOverArea, setDragOverArea] = useState<Area | null>(null)

  // Confirmation modal state.
  const [confirmReset, setConfirmReset] = useState<{ paths: string[]; area: Area } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string[] | null>(null)

  // Initial load (and re-load whenever the project changes — context resets
  // localDiff to null, so this re-fetches).
  useEffect(() => {
    if (localDiff === null) {
      loadLocalDiff().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
    }
  }, [localDiff, loadLocalDiff])

  // Compose the displayed entries. Untracked files come from `status` (they
  // don't have a diff entry of their own) — surfaced alongside the unstaged
  // section since that's their staging "from" position.
  const stagedEntries = useMemo<LocalDiffEntry[]>(() => localDiff?.staged ?? [], [localDiff])
  const unstagedEntries = useMemo<LocalDiffEntry[]>(
    () =>
      mergeUnstagedWithUntracked(localDiff?.unstaged ?? [], status?.untracked ?? [], (path) => ({
        path,
        status: '?',
      })),
    [localDiff, status],
  )

  // Selection model (multi-select, shift/cmd, advance-on-stage) lives in the
  // shared hook; the pane maps row gestures + rendering onto it.
  const stagedPaths = useMemo(() => stagedEntries.map((f) => f.path), [stagedEntries])
  const unstagedPaths = useMemo(() => unstagedEntries.map((f) => f.path), [unstagedEntries])
  const { primary, isSelected, selectedPathsIn, selectSingle, toggleOne, selectRange } =
    useLocalChangesSelection(stagedPaths, unstagedPaths)

  // Resolve the primary key back to its diff entry for the right-pane diff.
  const primarySelected = useMemo(() => {
    if (!primary) return null
    const list = primary.area === 'staged' ? stagedEntries : unstagedEntries
    const file = list.find((f) => f.path === primary.path)
    return file ? { area: primary.area, file } : null
  }, [primary, stagedEntries, unstagedEntries])

  const runOp = async (op: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await op()
    } catch (err) {
      // SDK throws raw axios errors on 4xx — pull the server's actual
      // `{ error }` body so the user sees what git failed on (e.g.
      // "patch does not apply") instead of the generic axios message.
      const server = extractServerError(err, 'Operation failed')
      setError(server.message)
    } finally {
      setBusy(false)
    }
  }

  const doStage = (paths: string[]) => {
    if (paths.length === 0) return
    void runOp(() => stage(paths))
  }
  const doUnstage = (paths: string[]) => {
    if (paths.length === 0) return
    void runOp(() => unstage(paths))
  }
  const doReset = (paths: string[], area: Area) => {
    if (paths.length === 0) return
    setConfirmReset({ paths, area })
  }
  const doRemove = (paths: string[]) => {
    if (paths.length === 0) return
    setConfirmRemove(paths)
  }

  // Selection click semantics — shift/cmd extends, plain click sets single.
  const onRowClick = (area: Area, path: string) => (e: MouseEvent) => {
    e.stopPropagation()
    const target = e.target as HTMLElement | null
    if (target?.tagName === 'INPUT' || target?.closest('button')) return
    if (e.metaKey || e.ctrlKey) toggleOne(area, path)
    else if (e.shiftKey) selectRange(area, path)
    else selectSingle(area, path)
  }

  // Checkbox toggling on a row stages/unstages that single file. Matches
  // desktop's `GitFileRow` behaviour — the checkbox column doubles as the
  // staging primary action so the toolbar isn't needed for the common case.
  const toggleChecked = (area: Area, path: string) => {
    if (area === 'staged') doUnstage([path])
    else doStage([path])
  }

  // Drag-drop — payload is `{ area, paths }` so the drop target knows which
  // direction to move them. If the drag originated on a selected row, drag
  // the whole multi-selection; otherwise just the dragged row.
  const onDragStartRow = (area: Area, path: string) => (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    const list = area === 'staged' ? stagedPaths : unstagedPaths
    const selInArea = selectedPathsIn(area, list)
    const paths = isSelected(area, path) && selInArea.length > 0 ? selInArea : [path]
    try {
      e.dataTransfer.setData('text/plain', JSON.stringify({ area, paths }))
    } catch {
      // Some browsers reject non-string content in drag data; the dropTarget
      // falls back to the local `dragOverArea` state.
    }
    if (paths.length > 1 && typeof document !== 'undefined') {
      const ghost = document.createElement('div')
      ghost.style.cssText =
        'position:fixed;top:-1000px;left:-1000px;z-index:999999;pointer-events:none;' +
        'padding:4px 8px;border-radius:6px;border:1px solid rgba(59,130,246,0.5);' +
        'background:rgba(59,130,246,0.08);font-size:12px;font-family:monospace'
      ghost.textContent = `${paths.length} files`
      document.body.appendChild(ghost)
      try {
        e.dataTransfer.setDragImage(ghost, 12, 12)
      } catch {
        // setDragImage isn't universal; safe to ignore.
      }
      const cleanup = () => {
        try {
          document.body.removeChild(ghost)
        } catch {
          // already detached by another cleanup invocation
        }
        document.removeEventListener('dragend', cleanup, true)
      }
      document.addEventListener('dragend', cleanup, true)
    }
  }

  const onDropTo = (target: Area) => (e: DragEvent) => {
    e.preventDefault()
    setDragOverArea(null)
    let paths: string[] = []
    try {
      const raw = e.dataTransfer.getData('text/plain')
      if (raw) {
        const payload = JSON.parse(raw) as { area?: Area; paths?: string[] }
        if (payload?.area && payload.area !== target && Array.isArray(payload.paths)) {
          paths = payload.paths
        }
      }
    } catch {
      // Malformed payload — drop is a no-op rather than crashing the pane.
    }
    if (paths.length === 0) return
    if (target === 'staged') doStage(paths)
    else doUnstage(paths)
  }

  // Section header — checkbox bulk-stages/unstages the whole section, label
  // shows count, dropdown chrome matches desktop's compact uppercase style.
  const renderSectionHeader = (area: Area, entries: LocalDiffEntry[]) => {
    const label = area === 'staged' ? 'Staged' : 'Unstaged'
    const action = area === 'staged' ? 'Unstage all' : 'Stage all'
    const allChecked = entries.length > 0 && area === 'staged'
    return (
      <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-(--text-muted) border-b border-(--border-subtle) flex items-center justify-between shrink-0 bg-(--surface-muted)">
        <span>
          {label} <span className="opacity-60">({entries.length})</span>
        </span>
        <Tooltip content={action} placement="bottom">
          <input
            type="checkbox"
            aria-label={action}
            checked={allChecked}
            disabled={entries.length === 0 || busy}
            onChange={() =>
              area === 'staged'
                ? doUnstage(entries.map((f) => f.path))
                : doStage(entries.map((f) => f.path))
            }
          />
        </Tooltip>
      </div>
    )
  }

  const renderRows = (area: Area, entries: LocalDiffEntry[]) => {
    if (entries.length === 0) {
      return (
        <div className="px-3 py-2 text-xs text-(--text-muted) italic">
          No {area === 'staged' ? 'staged' : 'unstaged'} files.
        </div>
      )
    }
    return entries.map((entry) => {
      const checked = area === 'staged'
      const localFile = entryToLocalFile(entry)
      return (
        <GitFileRow
          key={`${area}:${entry.path}`}
          file={localFile}
          checked={checked}
          selected={isSelected(area, entry.path)}
          draggable
          onToggle={() => toggleChecked(area, entry.path)}
          onReset={() => doReset([entry.path], area)}
          onRemove={() => doRemove([entry.path])}
          onResolveConflict={
            entry.isConflicted && onResolveConflict
              ? () => onResolveConflict(entry.path)
              : undefined
          }
          onDragStart={onDragStartRow(area, entry.path)}
          onClick={onRowClick(area, entry.path)}
        />
      )
    })
  }

  // Diff opts — wrap/ignoreWS/intra are interactive in desktop; keep web's
  // version conservative-but-usable, with defaults that match desktop.
  const [diffOpts, setDiffOpts] = useState<{ wrap: boolean; ignoreWS: boolean; intra: IntraMode }>({
    wrap: false,
    ignoreWS: false,
    intra: 'word',
  })

  const selectedPatch = primarySelected?.file.patch
  const selectedPath = primarySelected?.file.path
  const selectedConflicted = primarySelected?.file.isConflicted
  const selectedArea = primarySelected?.area

  // Wire partial-patch staging — `cached: true` writes to the index only;
  // `reverse: true` unstages already-cached hunks. Desktop's flow exactly.
  const handleApplyPatch = async (patch: string, reverse: boolean) => {
    if (!selectedPath) return
    await runOp(() => applyPatch({ patch, cached: true, reverse }))
  }
  const handleDiscardPatch = async (patch: string) => {
    if (!selectedPath) return
    setConfirmReset(null)
    await runOp(() => applyPatch({ patch, cached: false, reverse: true }))
  }

  return (
    <div className="flex flex-row min-h-0 h-full">
      {/* Left: resizable column with staged (top) + unstaged (bottom) */}
      <div
        ref={leftPaneRef}
        className="shrink-0 flex flex-col border-r border-(--border-subtle) overflow-hidden"
        style={{ width: leftWidth }}
      >
        {error && (
          <div className="px-3 py-2 shrink-0">
            <Alert>{error}</Alert>
          </div>
        )}
        {isLocalDiffLoading && localDiff === null ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-xs text-(--text-muted)">
            <Spinner /> Loading working tree…
          </div>
        ) : (
          <>
            <div
              className={`flex flex-col shrink-0 overflow-hidden ${
                dragOverArea === 'staged' ? 'bg-sky-50/40 dark:bg-sky-900/10' : ''
              }`}
              style={{ height: stagedHeight }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverArea('staged')
              }}
              onDragLeave={() => setDragOverArea((cur) => (cur === 'staged' ? null : cur))}
              onDrop={onDropTo('staged')}
            >
              {renderSectionHeader('staged', stagedEntries)}
              <div className="flex-1 min-h-0 overflow-auto">
                {renderRows('staged', stagedEntries)}
              </div>
            </div>

            <ResizeHandle
              orientation="horizontal"
              className="relative z-10 shrink-0"
              hitBoxSize={4}
              onResizeStart={onStagedResizeStart}
            />

            <div
              className={`flex flex-col flex-1 min-h-0 overflow-hidden ${
                dragOverArea === 'unstaged' ? 'bg-sky-50/40 dark:bg-sky-900/10' : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverArea('unstaged')
              }}
              onDragLeave={() => setDragOverArea((cur) => (cur === 'unstaged' ? null : cur))}
              onDrop={onDropTo('unstaged')}
            >
              {renderSectionHeader('unstaged', unstagedEntries)}
              <div className="flex-1 min-h-0 overflow-auto">
                {renderRows('unstaged', unstagedEntries)}
              </div>
            </div>
          </>
        )}
      </div>

      <ResizeHandle
        orientation="vertical"
        className="relative z-10 shrink-0"
        hitBoxSize={4}
        onResizeStart={onLeftResizeStart}
      />

      {/* Right: inline diff for the selected file. `onApplyPatch` /
        `onDiscardPatch` wire partial-hunk staging end-to-end. */}
      <div className="flex flex-col flex-1 min-w-0">
        {selectedPath ? (
          <DiffViewer
            path={selectedPath}
            patch={selectedPatch}
            wrap={diffOpts.wrap}
            ignoreWS={diffOpts.ignoreWS}
            intra={diffOpts.intra}
            onWrapChange={(wrap) => setDiffOpts((p) => ({ ...p, wrap }))}
            onIgnoreWSChange={(ignoreWS) => setDiffOpts((p) => ({ ...p, ignoreWS }))}
            onIntraChange={(intra) => setDiffOpts((p) => ({ ...p, intra }))}
            isStaged={selectedArea === 'staged'}
            isConflicted={selectedConflicted}
            selectionMode="drag"
            onApplyPatch={handleApplyPatch}
            onDiscardPatch={handleDiscardPatch}
            onResolveConflict={
              selectedConflicted && onResolveConflict && selectedPath
                ? () => onResolveConflict(selectedPath)
                : undefined
            }
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-(--text-muted)">
            Select a file to see its diff.
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmReset !== null}
        onClose={() => setConfirmReset(null)}
        onConfirm={async () => {
          const pending = confirmReset
          setConfirmReset(null)
          if (!pending) return
          await runOp(() =>
            pending.area === 'staged' ? unstage(pending.paths) : discardUnstaged(pending.paths),
          )
        }}
        title={confirmReset?.area === 'staged' ? 'Discard staged changes' : 'Discard local changes'}
        description={(() => {
          const n = confirmReset?.paths.length ?? 0
          const subject = n === 1 ? `"${confirmReset?.paths[0]}"` : `${n} file(s)`
          return confirmReset?.area === 'staged'
            ? `Discard the staged changes for ${subject}? The working-tree copy is kept.`
            : `Discard unstaged changes to ${subject}? This cannot be undone.`
        })()}
        confirmLabel="Discard"
        destructive={confirmReset?.area !== 'staged'}
      />
      <ConfirmDialog
        isOpen={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        onConfirm={async () => {
          const paths = confirmRemove ?? []
          setConfirmRemove(null)
          await runOp(() => removeFiles(paths))
        }}
        title="Delete files"
        description={
          confirmRemove && confirmRemove.length === 1
            ? `Delete "${confirmRemove[0]}" from the working tree? This cannot be undone.`
            : `Delete ${confirmRemove?.length ?? 0} file(s) from the working tree? This cannot be undone.`
        }
        confirmLabel="Delete"
        destructive
      />
    </div>
  )
}
