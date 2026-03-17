import React, { forwardRef, useImperativeHandle } from 'react'
import Spinner from '@renderer/components/ui/Spinner'
import Tooltip from '@renderer/components/ui/Tooltip'
import { gitService } from '@renderer/services/gitService'
import { filesService } from '@renderer/services/filesService'
import { IntraMode } from '@renderer/components/chat/tool-popups/diffUtils'
import { ResizeHandle } from '@renderer/components/ui/ResizeHandle'
import {
  IconDelete,
  IconFileAdded,
  IconFileDeleted,
  IconFileModified,
} from '@renderer/components/ui/icons/Icons'
import { IconRevert } from '@renderer/components/ui/icons/IconRevert'
import { PathDisplay } from '@renderer/components/ui/PathDisplay'
import { DiffViewer } from '@renderer/components/ui/DiffViewer'

export type LocalFileEntry = { path: string; status?: string; patch?: string; binary?: boolean }

export type LocalStatus = {
  staged: LocalFileEntry[]
  unstaged: LocalFileEntry[]
  untracked: LocalFileEntry[]
  conflicts?: any[]
}

function StatusIcon({
  status,
  className = 'w-5 h-5 flex-none',
}: {
  status?: string
  className?: string
}) {
  if (status === 'A') return <IconFileAdded className={className} />
  if (status === 'D') return <IconFileDeleted className={className} />
  return <IconFileModified className={className} />
}

function parseAddDel(patch?: string): { add: number; del: number } {
  if (!patch) return { add: 0, del: 0 }
  let add = 0,
    del = 0
  const lines = patch.replace(/\r\n/g, '\n').split('\n')
  for (const ln of lines) {
    if (ln.startsWith('+++ ') || ln.startsWith('--- ') || ln.startsWith('@@')) continue
    if (ln.startsWith('+')) add += 1
    else if (ln.startsWith('-')) del += 1
  }
  return { add, del }
}

export function FileChangesPills({ patch }: { patch?: string }) {
  if (!patch) return null
  const { add, del } = parseAddDel(patch)
  if (add === 0 && del === 0) return null

  return (
    <div className="flex items-center gap-1 shrink-0 text-[10px] font-mono leading-none">
      {add > 0 ? (
        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20">
          +{add}
        </span>
      ) : null}
      {del > 0 ? (
        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
          -{del}
        </span>
      ) : null}
    </div>
  )
}

function FileRow({
  file,
  checked,
  selected,
  onToggle,
  onReset,
  onRemove,
  draggable,
  onDragStart,
  onClick,
}: {
  file: LocalFileEntry
  checked: boolean
  selected?: boolean
  onToggle: (file: LocalFileEntry) => void
  onReset: (file: LocalFileEntry) => void
  onRemove: (file: LocalFileEntry) => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <div
      className={`group flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-neutral-200 dark:border-neutral-800 ${selected ? 'bg-sky-50 dark:bg-sky-900/25' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      role="row"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(file)}
          onClick={(e) => e.stopPropagation()}
          aria-label={checked ? 'Unstage file' : 'Stage file'}
        />
        <StatusIcon status={file.status} />
        <PathDisplay path={file.path} />
      </div>

      <div className="grid items-center shrink-0 min-h-[20px] justify-items-end pl-2">
        {/* The Pills fade out on row hover to make space for actions */}
        <div className="col-start-1 row-start-1 flex items-center justify-end opacity-100 group-hover:opacity-0 transition-opacity">
          <FileChangesPills patch={file.patch} />
        </div>
        {/* Actions fade in on row hover */}
        <div className="col-start-1 row-start-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip content={'Reset (discard local changes)'} placement="bottom">
            <button
              className="btn-secondary btn-icon text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              aria-label="Reset file changes"
              onClick={(e) => {
                e.stopPropagation()
                onReset(file)
              }}
            >
              <IconRevert className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content={'Remove (delete file)'} placement="bottom">
            <button
              className="btn-secondary btn-icon"
              aria-label="Remove file"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(file)
              }}
            >
              <IconDelete className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

export type GitLocalChangesProps = {
  projectId: string
  className?: string
  onStatusChange?: (status: LocalStatus) => void
  onBusyChange?: (busy: boolean) => void
  onErrorChange?: (error: string | undefined) => void
}

export interface GitLocalChangesRef {
  load: () => Promise<void>
}

export const GitLocalChanges = forwardRef<GitLocalChangesRef, GitLocalChangesProps>(
  ({ projectId, className = '', onStatusChange, onBusyChange, onErrorChange }, ref) => {
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | undefined>(undefined)
    const [status, setStatus] = React.useState<LocalStatus>({
      staged: [],
      unstaged: [],
      untracked: [],
    })

    const [selectedPath, setSelectedPath] = React.useState<string | undefined>(undefined)
    const [selectedPatch, setSelectedPatch] = React.useState<string>('')

    // Vertical divider (left/right)
    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const [leftWidth, setLeftWidth] = React.useState<number>(() =>
      Math.max(280, Math.floor(window.innerWidth * 0.28)),
    )
    const vertResizeRef = React.useRef<{ startX: number; startW: number } | null>(null)
    const [vertHandleY, setVertHandleY] = React.useState<number | null>(null)

    // Horizontal divider (staged/unstaged within left)
    const leftPaneRef = React.useRef<HTMLDivElement | null>(null)
    const stagedHeaderRef = React.useRef<HTMLDivElement | null>(null)
    const unstagedHeaderRef = React.useRef<HTMLDivElement | null>(null)
    const [stagedHeightPx, setStagedHeightPx] = React.useState<number>(200)
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
        const toEntry = (f: any): LocalFileEntry => ({
          path: f?.path || f?.oldPath || '',
          status: f?.status,
          patch: f?.patch,
          binary: !!f?.binary,
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
          conflicts: (s as any)?.conflicts || [],
        }
        setStatus(next)
        if (onStatusChange) onStatusChange(next)
        // Preserve multi-selection across refresh; default to first available
        const stagedPaths = next.staged.map((f) => f.path)
        const unPaths = [...next.unstaged, ...next.untracked].map((f) => f.path)
        setSelection((prev) => {
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

    // Primary selection (staged first) and reflect into selectedPath/patch
    const primarySelected = React.useMemo(() => {
      const staged = status.staged.map((f) => f.path)
      const un = [...status.unstaged, ...status.untracked].map((f) => f.path)
      for (const p of staged)
        if (selection.has(makeKey('staged', p))) return { area: 'staged' as const, path: p }
      for (const p of un)
        if (selection.has(makeKey('unstaged', p))) return { area: 'unstaged' as const, path: p }
      return null
    }, [status, selection, makeKey])

    React.useEffect(() => {
      const all = [...status.staged, ...status.unstaged, ...status.untracked]
      const f = primarySelected ? all.find((x) => x.path === primarySelected.path) : undefined
      setSelectedPatch(f?.patch || '')
      setSelectedPath(primarySelected?.path)
    }, [status, primarySelected])

    const notifyBusy = (busy: boolean) => {
      if (onBusyChange) onBusyChange(busy)
    }
    const notifyError = (err: string | undefined) => {
      if (onErrorChange) onErrorChange(err)
    }

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
      const ok = window.confirm(
        'Discard local changes to the selected file(s)? This cannot be undone.',
      )
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
      const ok = window.confirm(
        'Delete the selected file(s) from the working tree? This cannot be undone.',
      )
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
      // Multi-drag ghost: show N files
      try {
        if (paths.length > 1) {
          const ghost = document.createElement('div')
          ghost.style.position = 'fixed'
          ghost.style.top = '-1000px'
          ghost.style.left = '-1000px'
          ghost.style.zIndex = '999999'
          ghost.style.pointerEvents = 'none'
          ghost.style.padding = '4px 8px'
          ghost.style.borderRadius = '6px'
          ghost.style.border = '1px solid rgba(59,130,246,0.5)'
          ghost.style.background = 'rgba(59,130,246,0.08)'
          ghost.style.color = 'inherit'
          ghost.style.fontSize = '12px'
          ghost.style.fontFamily =
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
          ghost.textContent = `${paths.length} files`
          document.body.appendChild(ghost)
          try {
            e.dataTransfer.setDragImage(ghost, 12, 12)
          } catch {}
          const cleanup = () => {
            try {
              document.body.removeChild(ghost)
            } catch {}
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
      const keys = list.slice(start, end + 1).map((p) => makeKey(area, p))
      setSelection(new Set(keys))
    }

    // Resizers
    const onVertResizeStart = (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      vertResizeRef.current = { startX: e.clientX, startW: leftWidth }
      const onMove = (ev: PointerEvent) => {
        const st = vertResizeRef.current
        if (!st) return
        const dx = ev.clientX - st.startX
        const next = st.startW + dx
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
      const handleH = 8
      const avail = Math.max(100, panel.clientHeight - stagedH - unstagedH - handleH)
      const estimatedRowPx = 28
      const minPx = Math.max(estimatedRowPx * 2, Math.floor(avail * 0.2))
      horResizeRef.current = { startY: e.clientY, startH: stagedHeightPx, avail, minPx }
      const onMove = (ev: PointerEvent) => {
        const st = horResizeRef.current
        if (!st) return
        const dy = ev.clientY - st.startY
        const next = st.startH + dy
        const maxPx = st.avail - st.minPx
        const clamped = Math.max(st.minPx, Math.min(maxPx, next))
        setStagedHeightPx(clamped)
      }
      const onUp = () => {
        horResizeRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }

    // Keep 20%/80% constraints based on current container width
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

    // Ensure staged min height shows at least 2 rows and 20% of pane
    React.useEffect(() => {
      const panel = leftPaneRef.current
      if (!panel) return
      const estimatedRowPx = 28
      const stagedHMin = Math.max(estimatedRowPx * 2, Math.floor(panel.clientHeight * 0.2))
      setStagedHeightPx((h) => Math.max(stagedHMin, h))
    }, [leftWidth])

    const rightWidth = `calc(100% - ${leftWidth}px)`

    // Diff view toggles
    const [wrap, setWrap] = React.useState<boolean>(false)
    const [ignoreWS, setIgnoreWS] = React.useState<boolean>(false)
    const [intra, setIntra] = React.useState<IntraMode>('none')

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
                title="Unstage all"
              />
            </Tooltip>
          </div>
          {/* Staged list */}
          <div
            className={`overflow-auto shrink-0 ${dragOverArea === 'staged' && dragItem?.area !== 'staged' ? 'outline outline-1 outline-teal-500/60 bg-teal-500/5' : ''}`}
            style={{ height: stagedHeightPx }}
            onDragOver={(e) => {
              if (dragItem && dragItem.area !== 'staged') {
                e.preventDefault()
                setDragOverArea('staged')
              }
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
                {status.staged.map((f) => {
                  const sel = isSelected('staged', f.path)
                  return (
                    <FileRow
                      key={`staged:${f.path}`}
                      file={f}
                      checked={true}
                      selected={sel}
                      onToggle={() => unstage([f.path])}
                      onReset={() => reset([f.path])}
                      onRemove={() => remove([f.path])}
                      draggable
                      onDragStart={onDragStartRow('staged', f.path)}
                      onClick={(e) => {
                        if ((e as any).shiftKey) selectRange('staged', f.path)
                        else if ((e as any).metaKey || (e as any).ctrlKey)
                          toggleOne('staged', f.path)
                        else selectSingle('staged', f.path)
                      }}
                    />
                  )
                })}
                {status.staged.length === 0 && (
                  <div className="p-2 text-xs text-neutral-500">No staged files.</div>
                )}
              </div>
            ) : (
              <div className="p-2 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
                {error}
              </div>
            )}
          </div>
          {/* Horizontal resizer with visible divider and cursor handle under mouse */}
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
                title="Stage all"
              />
            </Tooltip>
          </div>
          {/* Unstaged list */}
          <div
            className={`min-h-[120px] flex-1 overflow-auto ${dragOverArea === 'unstaged' && dragItem?.area !== 'unstaged' ? 'outline outline-1 outline-teal-500/60 bg-teal-500/5' : ''}`}
            onDragOver={(e) => {
              if (dragItem && dragItem.area !== 'unstaged') {
                e.preventDefault()
                setDragOverArea('unstaged')
              }
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
                {[...status.unstaged, ...status.untracked].map((f) => {
                  const sel = isSelected('unstaged', f.path)
                  return (
                    <FileRow
                      key={`unstaged:${f.path}`}
                      file={f}
                      checked={false}
                      selected={sel}
                      onToggle={() => stage([f.path])}
                      onReset={() => reset([f.path])}
                      onRemove={() => remove([f.path])}
                      draggable
                      onDragStart={onDragStartRow('unstaged', f.path)}
                      onClick={(e) => {
                        if ((e as any).shiftKey) selectRange('unstaged', f.path)
                        else if ((e as any).metaKey || (e as any).ctrlKey)
                          toggleOne('unstaged', f.path)
                        else selectSingle('unstaged', f.path)
                      }}
                    />
                  )
                })}
                {[...status.unstaged, ...status.untracked].length === 0 && (
                  <div className="p-2 text-xs text-neutral-500">No unstaged files.</div>
                )}
              </div>
            ) : (
              <div className="p-2 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Vertical Divider with handle under cursor */}
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

        {/* Right panel */}
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
          />
        </div>
      </div>
    )
  },
)
