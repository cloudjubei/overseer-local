import React, { forwardRef, useImperativeHandle } from 'react'
import Spinner from '@renderer/components/ui/Spinner'
import Tooltip from '@renderer/components/ui/Tooltip'
import { gitService } from '@renderer/services/gitService'
import { filesService } from '@renderer/services/filesService'
import { IntraMode } from '@renderer/components/chat/tool-popups/diffUtils'
import { ResizeHandle } from '@renderer/components/ui/ResizeHandle'
import { DiffViewer } from '@renderer/components/ui/DiffViewer'
import GitFileRow, { LocalFileEntry } from './common/GitFileRow'
import { useLocalStorage } from '@renderer/hooks/useLocalStorage'

export type LocalStatus = {
  staged: LocalFileEntry[]
  unstaged: LocalFileEntry[]
  untracked: LocalFileEntry[]
  conflicts?: string[]
}

export type GitLocalChangesProps = {
  projectId: string
  className?: string
  onStatusChange?: (status: LocalStatus) => void
  onBusyChange?: (busy: boolean) => void
  onErrorChange?: (error: string | undefined) => void
  /** Called when the user clicks "Resolve Conflict" on a conflicted file row or in DiffViewer */
  onResolveConflict?: (filePath: string) => void
}

export interface GitLocalChangesRef {
  load: () => Promise<void>
}

export const GitLocalChanges = forwardRef<GitLocalChangesRef, GitLocalChangesProps>(
  ({ projectId, className = '', onStatusChange, onBusyChange, onErrorChange, onResolveConflict }, ref) => {
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | undefined>(undefined)
    const [status, setStatus] = React.useState<LocalStatus>({
      staged: [],
      unstaged: [],
      untracked: [],
      conflicts: [],
    })

    const [selectedPath, setSelectedPath] = React.useState<string | undefined>(undefined)
    const [selectedArea, setSelectedArea] = React.useState<'staged' | 'unstaged' | undefined>(undefined)

    // Vertical divider (left/right)
    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const [leftWidth, setLeftWidth] = useLocalStorage<number>(
      'GitLocalChanges_leftWidth',
      Math.max(280, Math.floor(window.innerWidth * 0.28)),
    )
    const vertResizeRef = React.useRef<{ startX: number; startW: number } | null>(null)
    const [vertHandleY, setVertHandleY] = React.useState<number | null>(null)

    // Horizontal divider (staged/unstaged within left)
    const leftPaneRef = React.useRef<HTMLDivElement | null>(null)
    const stagedHeaderRef = React.useRef<HTMLDivElement | null>(null)
    const unstagedHeaderRef = React.useRef<HTMLDivElement | null>(null)
    const [stagedHeightPx, setStagedHeightPx] = useLocalStorage<number>(
      'GitLocalChanges_stagedHeightPx',
      200,
    )
    const horResizeRef = React.useRef<{
      startY: number
      startH: number
      avail: number
      minPx: number
    } | null>(null)
    const [horHandleX, setHorHandleX] = React.useState<number | null>(null)

    // Multi-select and Section-level DnD
    const [selection, setSelection] = React.useState<Set<string>>(new Set())
    const lastSelectedRef = React.useRef<{ area: 'staged' | 'unstaged'; path: string } | null>(null)
    const [dragItem, setDragItem] = React.useState<{
      area: 'staged' | 'unstaged'
      paths: string[]
    } | null>(null)
    const [dragOverArea, setDragOverArea] = React.useState<'staged' | 'unstaged' | null>(null)

    const makeKey = React.useCallback(
      (area: 'staged' | 'unstaged', path: string) => `${area}:${path}`,
      [],
    )

    const load = React.useCallback(async () => {
      setLoading(true)
      setError(undefined)
      if (onErrorChange) onErrorChange(undefined)
      try {
        const [stagedList, unstagedList, s] = await Promise.all([
          gitService.getLocalDiffSummary(projectId, {
            staged: true,
            includePatch: true,
            includeStructured: true,
          }),
          gitService.getLocalDiffSummary(projectId, {
            staged: false,
            includePatch: true,
            includeStructured: true,
          }),
          gitService.getLocalStatus(projectId),
        ])

        // Conflicted paths: files with status 'U' (unmerged) in either diff list
        const conflictedPaths = new Set<string>([
          ...(Array.isArray(stagedList) ? stagedList : [])
            .filter((f: any) => f?.status === 'U')
            .map((f: any) => f?.path || ''),
          ...(Array.isArray(unstagedList) ? unstagedList : [])
            .filter((f: any) => f?.status === 'U')
            .map((f: any) => f?.path || ''),
        ])

        const toEntry = (f: any): LocalFileEntry => ({
          path: f?.path || f?.oldPath || '',
          status: f?.status,
          patch: f?.patch,
          binary: !!f?.binary,
          isConflicted: conflictedPaths.has(f?.path || f?.oldPath || ''),
        })

        const staged = (Array.isArray(stagedList) ? stagedList : [])
          .map(toEntry)
          .filter((f) => f.path)
        const unstaged = (Array.isArray(unstagedList) ? unstagedList : [])
          .map(toEntry)
          .filter((f) => f.path)
        const untrackedPaths: string[] = Array.isArray((s as any)?.untracked)
          ? (s as any).untracked
          : []
        const untracked = untrackedPaths.map((p) => ({ path: p, status: 'A' }) as LocalFileEntry)
        const next: LocalStatus = {
          staged,
          unstaged,
          untracked,
          conflicts: Array.from(conflictedPaths).filter(Boolean),
        }
        setStatus(next)
        if (onStatusChange) onStatusChange(next)
        // Preserve selection across refresh
        setSelection((prev) => {
          const stagedPaths = next.staged.map((f) => f.path)
          const unPaths = [...next.unstaged, ...next.untracked].map((f) => f.path)
          const nextSel = new Set<string>()
          for (const k of prev) {
            const [area, ...rest] = k.split(':')
            const p = rest.join(':')
            if (
              (area === 'staged' && stagedPaths.includes(p)) ||
              (area === 'unstaged' && unPaths.includes(p))
            )
              nextSel.add(k)
          }
          if (nextSel.size === 0) {
            if (stagedPaths[0]) nextSel.add(makeKey('staged', stagedPaths[0]))
            else if (unPaths[0]) nextSel.add(makeKey('unstaged', unPaths[0]))
          }
          return nextSel
        })
      } catch (e: any) {
        setError(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    }, [projectId, makeKey, onStatusChange, onErrorChange])

    useImperativeHandle(ref, () => ({ load }), [load])

    React.useEffect(() => {
      void load()
    }, [load])

    // Primary selection (staged first) and reflect into selectedPath/area
    const primarySelected = React.useMemo(() => {
      const staged = status.staged.map((f) => f.path)
      const un = [...status.unstaged, ...status.untracked].map((f) => f.path)
      for (const p of staged)
        if (selection.has(makeKey('staged', p))) return { area: 'staged' as const, path: p }
      for (const p of un)
        if (selection.has(makeKey('unstaged', p))) return { area: 'unstaged' as const, path: p }
      return null
    }, [status, selection, makeKey])

    // Derive the patch to show
    const selectedPatch = React.useMemo(() => {
      if (!primarySelected) return ''
      const list =
        primarySelected.area === 'staged'
          ? status.staged
          : [...status.unstaged, ...status.untracked]
      const f = list.find((x) => x.path === primarySelected.path)
      return f?.patch || ''
    }, [primarySelected, status])

    // Is the currently-selected file conflicted?
    const selectedIsConflicted = React.useMemo(() => {
      if (!primarySelected) return false
      const list =
        primarySelected.area === 'staged'
          ? status.staged
          : [...status.unstaged, ...status.untracked]
      return list.find((x) => x.path === primarySelected.path)?.isConflicted ?? false
    }, [primarySelected, status])

    React.useEffect(() => {
      setSelectedPath(primarySelected?.path)
      setSelectedArea(primarySelected?.area)
    }, [primarySelected])

    const notifyBusy = (busy: boolean) => { if (onBusyChange) onBusyChange(busy) }
    const notifyError = (err: string | undefined) => { if (onErrorChange) onErrorChange(err) }

    // Git operations
    const stage = async (paths: string[]) => {
      if (!paths.length) return
      notifyBusy(true)
      notifyError(undefined)
      try {
        const res = await gitService.stage(projectId, paths)
        if (!res?.ok) notifyError(res?.error || 'Failed to stage')
      } catch (e: any) {
        notifyError(e?.message || String(e))
      } finally {
        notifyBusy(false)
        void load()
      }
    }

    const unstage = async (paths: string[]) => {
      if (!paths.length) return
      notifyBusy(true)
      notifyError(undefined)
      try {
        const res = await gitService.unstage(projectId, paths)
        if (!res?.ok) notifyError(res?.error || 'Failed to unstage')
      } catch (e: any) {
        notifyError(e?.message || String(e))
      } finally {
        notifyBusy(false)
        void load()
      }
    }

    const reset = async (paths: string[]) => {
      if (!paths.length) return
      const ok = window.confirm('Discard local changes to the selected file(s)? This cannot be undone.')
      if (!ok) return
      notifyBusy(true)
      notifyError(undefined)
      try {
        const res = await gitService.reset(projectId, paths)
        if (!res?.ok) notifyError(res?.error || 'Failed to reset')
      } catch (e: any) {
        notifyError(e?.message || String(e))
      } finally {
        notifyBusy(false)
        void load()
      }
    }

    const remove = async (paths: string[]) => {
      if (!paths.length) return
      const ok = window.confirm('Delete the selected file(s) from the working tree? This cannot be undone.')
      if (!ok) return
      notifyBusy(true)
      notifyError(undefined)
      try {
        await Promise.all(paths.map((p) => filesService.deletePath(projectId, p)))
      } catch (e: any) {
        notifyError(e?.message || String(e))
      } finally {
        notifyBusy(false)
        void load()
      }
    }

    // Drag helpers
    const onDragStartRow = (area: 'staged' | 'unstaged', path: string) => (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      const allInArea =
        area === 'staged'
          ? status.staged.map((f) => f.path)
          : [...status.unstaged, ...status.untracked].map((f) => f.path)
      const selInArea = allInArea.filter((p) => selection.has(makeKey(area, p)))
      const paths = selection.has(makeKey(area, path)) && selInArea.length > 0 ? selInArea : [path]
      setDragItem({ area, paths })
      try {
        e.dataTransfer.setData('text/plain', JSON.stringify({ area, paths }))
      } catch {}
      try {
        if (paths.length > 1) {
          const ghost = document.createElement('div')
          ghost.style.cssText =
            'position:fixed;top:-1000px;left:-1000px;z-index:999999;pointer-events:none;' +
            'padding:4px 8px;border-radius:6px;border:1px solid rgba(59,130,246,0.5);' +
            'background:rgba(59,130,246,0.08);font-size:12px;font-family:monospace'
          ghost.textContent = `${paths.length} files`
          document.body.appendChild(ghost)
          try { e.dataTransfer.setDragImage(ghost, 12, 12) } catch {}
          const cleanup = () => {
            try { document.body.removeChild(ghost) } catch {}
            document.removeEventListener('dragend', cleanup, true)
          }
          document.addEventListener('dragend', cleanup, true)
        }
      } catch {}
    }

    const onDropTo = (target: 'staged' | 'unstaged') => async (e: React.DragEvent) => {
      e.preventDefault()
      try {
        const raw = e.dataTransfer.getData('text/plain')
        let paths: string[] = []
        if (raw) {
          const payload = JSON.parse(raw)
          if (Array.isArray(payload?.paths)) paths = payload.paths
          else if (payload?.path) paths = [payload.path]
        }
        if (paths.length === 0 && dragItem?.paths?.length) paths = dragItem.paths
        if (paths.length === 0) return
        if (target === 'staged') await stage(paths)
        else await unstage(paths)
      } finally {
        setDragOverArea(null)
        setDragItem(null)
      }
    }

    // Selection helpers
    const isSelected = (area: 'staged' | 'unstaged', path: string) =>
      selection.has(makeKey(area, path))
    const selectSingle = (area: 'staged' | 'unstaged', path: string) => {
      setSelection(new Set([makeKey(area, path)]))
      lastSelectedRef.current = { area, path }
    }
    const toggleOne = (area: 'staged' | 'unstaged', path: string) => {
      setSelection((prev) => {
        const next = new Set(prev)
        const k = makeKey(area, path)
        if (next.has(k)) next.delete(k)
        else next.add(k)
        return next
      })
      lastSelectedRef.current = { area, path }
    }
    const selectRange = (area: 'staged' | 'unstaged', path: string) => {
      const anchor = lastSelectedRef.current
      const list =
        area === 'staged'
          ? status.staged.map((f) => f.path)
          : [...status.unstaged, ...status.untracked].map((f) => f.path)
      if (!anchor || anchor.area !== area) return selectSingle(area, path)
      const a = list.indexOf(anchor.path)
      const b = list.indexOf(path)
      if (a === -1 || b === -1) return selectSingle(area, path)
      const [start, end] = a <= b ? [a, b] : [b, a]
      setSelection(new Set(list.slice(start, end + 1).map((p) => makeKey(area, p))))
    }

    // Resizers
    const onVertResizeStart = (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      vertResizeRef.current = { startX: e.clientX, startW: leftWidth }
      const onMove = (ev: PointerEvent) => {
        const st = vertResizeRef.current
        if (!st) return
        const next = st.startW + ev.clientX - st.startX
        const containerW = rootRef.current?.clientWidth || window.innerWidth
        const minLeft = Math.max(260, Math.floor(containerW * 0.2))
        const maxLeft = Math.floor(containerW * 0.8)
        setLeftWidth(Math.max(minLeft, Math.min(maxLeft, next)))
      }
      const onUp = () => {
        vertResizeRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }

    const onHorResizeStart = (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      const panel = leftPaneRef.current
      if (!panel) return
      const stagedH = stagedHeaderRef.current?.offsetHeight || 0
      const unstagedH = unstagedHeaderRef.current?.offsetHeight || 0
      const avail = Math.max(100, panel.clientHeight - stagedH - unstagedH - 8)
      const minPx = Math.max(56, Math.floor(avail * 0.2))
      horResizeRef.current = { startY: e.clientY, startH: stagedHeightPx, avail, minPx }
      const onMove = (ev: PointerEvent) => {
        const st = horResizeRef.current
        if (!st) return
        const next = st.startH + ev.clientY - st.startY
        setStagedHeightPx(Math.max(st.minPx, Math.min(st.avail - st.minPx, next)))
      }
      const onUp = () => {
        horResizeRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }

    React.useEffect(() => {
      const clampNow = () => {
        const containerW = rootRef.current?.clientWidth || window.innerWidth
        const minLeft = Math.max(260, Math.floor(containerW * 0.2))
        const maxLeft = Math.floor(containerW * 0.8)
        setLeftWidth((w) => Math.max(minLeft, Math.min(maxLeft, w)))
      }
      clampNow()
      window.addEventListener('resize', clampNow)
      return () => window.removeEventListener('resize', clampNow)
    }, [])

    React.useEffect(() => {
      const panel = leftPaneRef.current
      if (!panel) return
      const stagedHMin = Math.max(56, Math.floor(panel.clientHeight * 0.2))
      setStagedHeightPx((h) => Math.max(stagedHMin, h))
    }, [leftWidth])

    const rightWidth = `calc(100% - ${leftWidth}px)`

    // Diff view toggles
    const [wrap, setWrap] = useLocalStorage<boolean>('GitLocalChanges_wrap', false)
    const [ignoreWS, setIgnoreWS] = useLocalStorage<boolean>('GitLocalChanges_ignoreWS', false)
    const [intra, setIntra] = useLocalStorage<IntraMode>('GitLocalChanges_intra', 'none')

    const handleApplyPatch = async (patch: string, reverse: boolean) => {
      if (!selectedPath) return
      notifyBusy(true)
      notifyError(undefined)
      try {
        const res = await gitService.applyPatch(projectId, { patch, cached: true, reverse })
        if (!res?.ok) notifyError(res?.error || 'Failed to apply patch')
      } catch (e: any) {
        notifyError(e?.message || String(e))
      } finally {
        notifyBusy(false)
        void load()
      }
    }

    const handleDiscardPatch = async (patch: string) => {
      if (!selectedPath) return
      const ok = window.confirm('Discard these changes from the working tree? This cannot be undone.')
      if (!ok) return
      notifyBusy(true)
      notifyError(undefined)
      try {
        const res = await gitService.applyPatch(projectId, { patch, cached: false, reverse: true })
        if (!res?.ok) notifyError(res?.error || 'Failed to discard patch')
      } catch (e: any) {
        notifyError(e?.message || String(e))
      } finally {
        notifyBusy(false)
        void load()
      }
    }

    return (
      <div ref={rootRef} className={`relative flex w-full min-h-0 h-full ${className}`}>
        {/* Left panel */}
        <div
          ref={leftPaneRef}
          className="shrink-0 border-r border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col h-full"
          style={{ width: leftWidth }}
        >
          {/* Staged header */}
          <div
            ref={stagedHeaderRef}
            className="px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0"
          >
            <span>Staged</span>
            <Tooltip content={'Unstage all'} placement="bottom">
              <input
                type="checkbox"
                checked={(status.staged?.length || 0) > 0}
                onChange={(e) => {
                  if (!e.target.checked && (status.staged?.length || 0) > 0)
                    void unstage(status.staged.map((f) => f.path))
                }}
                aria-label="Unstage all"
              />
            </Tooltip>
          </div>

          {/* Staged list */}
          <div
            className={`overflow-auto shrink-0 ${dragOverArea === 'staged' && dragItem?.area !== 'staged' ? 'outline outline-1 outline-teal-500/60 bg-teal-500/5' : ''}`}
            style={{ height: stagedHeightPx }}
            onDragOver={(e) => {
              if (dragItem && dragItem.area !== 'staged') { e.preventDefault(); setDragOverArea('staged') }
            }}
            onDragLeave={() => setDragOverArea((prev) => (prev === 'staged' ? null : prev))}
            onDrop={onDropTo('staged')}
          >
            {loading ? (
              <div className="p-2 text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                <Spinner size={12} label="Loading..." />
              </div>
            ) : !error ? (
              <div>
                {status.staged.map((f) => (
                  <GitFileRow
                    key={`staged:${f.path}`}
                    file={f}
                    checked={true}
                    selected={isSelected('staged', f.path)}
                    onToggle={() => unstage([f.path])}
                    onReset={() => reset([f.path])}
                    onRemove={() => remove([f.path])}
                    onResolveConflict={onResolveConflict ? () => onResolveConflict(f.path) : undefined}
                    draggable
                    onDragStart={onDragStartRow('staged', f.path)}
                    onClick={(e) => {
                      if ((e as any).shiftKey) selectRange('staged', f.path)
                      else if ((e as any).metaKey || (e as any).ctrlKey) toggleOne('staged', f.path)
                      else selectSingle('staged', f.path)
                    }}
                  />
                ))}
                {status.staged.length === 0 && (
                  <div className="p-2 text-xs text-neutral-500">No staged files.</div>
                )}
              </div>
            ) : (
              <div className="p-2 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</div>
            )}
          </div>

          {/* Horizontal resizer */}
          <ResizeHandle
            orientation="horizontal"
            className="relative z-10 border-y border-neutral-200 dark:border-neutral-800"
            hitBoxSize={8}
            onResizeStart={onHorResizeStart}
            handlePos={horHandleX ?? undefined}
            onMouseMove={(e) => {
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              setHorHandleX(e.clientX - r.left)
            }}
          />

          {/* Unstaged header */}
          <div
            ref={unstagedHeaderRef}
            className="px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0"
          >
            <span>Unstaged</span>
            <Tooltip content={'Stage all'} placement="bottom">
              <input
                type="checkbox"
                checked={[...status.unstaged, ...status.untracked].length === 0}
                onChange={(e) => {
                  if (e.target.checked && [...status.unstaged, ...status.untracked].length > 0)
                    void stage([...status.unstaged, ...status.untracked].map((f) => f.path))
                }}
                aria-label="Stage all"
              />
            </Tooltip>
          </div>

          {/* Unstaged list */}
          <div
            className={`min-h-[120px] flex-1 overflow-auto ${dragOverArea === 'unstaged' && dragItem?.area !== 'unstaged' ? 'outline outline-1 outline-teal-500/60 bg-teal-500/5' : ''}`}
            onDragOver={(e) => {
              if (dragItem && dragItem.area !== 'unstaged') { e.preventDefault(); setDragOverArea('unstaged') }
            }}
            onDragLeave={() => setDragOverArea((prev) => (prev === 'unstaged' ? null : prev))}
            onDrop={onDropTo('unstaged')}
          >
            {loading ? (
              <div className="p-2 text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                <Spinner size={12} label="Loading..." />
              </div>
            ) : !error ? (
              <div>
                {[...status.unstaged, ...status.untracked].map((f) => (
                  <GitFileRow
                    key={`unstaged:${f.path}`}
                    file={f}
                    checked={false}
                    selected={isSelected('unstaged', f.path)}
                    onToggle={() => stage([f.path])}
                    onReset={() => reset([f.path])}
                    onRemove={() => remove([f.path])}
                    onResolveConflict={onResolveConflict ? () => onResolveConflict(f.path) : undefined}
                    draggable
                    onDragStart={onDragStartRow('unstaged', f.path)}
                    onClick={(e) => {
                      if ((e as any).shiftKey) selectRange('unstaged', f.path)
                      else if ((e as any).metaKey || (e as any).ctrlKey) toggleOne('unstaged', f.path)
                      else selectSingle('unstaged', f.path)
                    }}
                  />
                ))}
                {[...status.unstaged, ...status.untracked].length === 0 && (
                  <div className="p-2 text-xs text-neutral-500">No unstaged files.</div>
                )}
              </div>
            ) : (
              <div className="p-2 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</div>
            )}
          </div>
        </div>

        <ResizeHandle
          orientation="vertical"
          className="absolute top-0 bottom-0 z-10"
          style={{ left: leftWidth - 6 }}
          hitBoxSize={12}
          onResizeStart={onVertResizeStart}
          handlePos={vertHandleY ?? undefined}
          onMouseMove={(e) => {
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
            setVertHandleY(e.clientY - r.top)
          }}
        />

        {/* Right panel — diff viewer */}
        <div className="min-w-0 min-h-0 flex flex-col h-full" style={{ width: rightWidth }}>
          <DiffViewer
            path={selectedPath}
            patch={selectedPatch}
            wrap={wrap}
            ignoreWS={ignoreWS}
            intra={intra}
            onWrapChange={setWrap}
            onIgnoreWSChange={setIgnoreWS}
            onIntraChange={setIntra}
            isStaged={selectedArea === 'staged'}
            onApplyPatch={handleApplyPatch}
            onDiscardPatch={handleDiscardPatch}
            isConflicted={selectedIsConflicted}
            onResolveConflict={
              selectedPath && onResolveConflict
                ? () => onResolveConflict(selectedPath)
                : undefined
            }
          />
        </div>
      </div>
    )
  },
)
