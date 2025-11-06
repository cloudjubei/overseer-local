import React from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import Spinner from '@renderer/components/ui/Spinner'
import Tooltip from '@renderer/components/ui/Tooltip'
import { gitService } from '@renderer/services/gitService'
import { filesService } from '@renderer/services/filesService'
import { StructuredUnifiedDiff } from '@renderer/components/chat/tool-popups/diffUtils'
import { IconDelete, IconRefresh, IconFileAdded, IconFileDeleted, IconFileModified, IconMaximize, IconMinimize } from '@renderer/components/ui/icons/Icons'

export type GitCommitModalProps = {
  projectId: string
  currentBranch: string
  onRequestClose: () => void
}

type LocalFileEntry = { path: string; status?: string; patch?: string; binary?: boolean }

type LocalStatus = { staged: LocalFileEntry[]; unstaged: LocalFileEntry[]; untracked: LocalFileEntry[]; conflicts?: any[] }

function splitPath(p: string): { dir: string; name: string } {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  if (idx === -1) return { dir: '', name: p }
  return { dir: p.slice(0, idx + 1), name: p.slice(idx + 1) }
}

function StatusIcon({ status, className = 'w-5 h-5 flex-none' }: { status?: string; className?: string }) {
  if (status === 'A') return <IconFileAdded className={className} />
  if (status === 'D') return <IconFileDeleted className={className} />
  return <IconFileModified className={className} />
}

// Left aligned path with bold filename; directory left-truncated (RTL trick)
function PathDisplay({ path }: { path: string }) {
  const { dir, name } = splitPath(path)
  return (
    <div className='flex items-baseline gap-1 min-w-0'>
      <span className='truncate max-w-[65%]' style={{ direction: 'rtl', textAlign: 'left' }}>
        <span style={{ direction: 'ltr' }} className='text-neutral-500'>
          {dir}
        </span>
      </span>
      <span className='font-mono font-semibold shrink-0'>{name}</span>
    </div>
  )
}

function FileRow({ file, checked, selected, onToggle, onReset, onRemove, draggable, onDragStart, onClick }: {
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
      role='row'
    >
      <div className='flex items-center gap-2 min-w-0 flex-1'>
        <input type='checkbox' checked={checked} onChange={() => onToggle(file)} onClick={(e) => e.stopPropagation()} aria-label={checked ? 'Unstage file' : 'Stage file'} />
        <StatusIcon status={file.status} />
        <PathDisplay path={file.path} />
      </div>
      <div className='opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1'>
        <Tooltip content={'Reset (discard local changes)'} placement='bottom'>
          <button className='btn-secondary btn-icon' aria-label='Reset file changes' onClick={(e) => { e.stopPropagation(); onReset(file) }}>
            <IconRefresh className='w-4 h-4' />
          </button>
        </Tooltip>
        <Tooltip content={'Remove (delete file)'} placement='bottom'>
          <button className='btn-secondary btn-icon' aria-label='Remove file' onClick={(e) => { e.stopPropagation(); onRemove(file) }}>
            <IconDelete className='w-4 h-4' />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

export default function GitCommitModal({ projectId, currentBranch, onRequestClose }: GitCommitModalProps) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | undefined>(undefined)
  const [status, setStatus] = React.useState<LocalStatus>({ staged: [], unstaged: [], untracked: [] })

  const [selectedPath, setSelectedPath] = React.useState<string | undefined>(undefined)
  const [selectedPatch, setSelectedPatch] = React.useState<string>('')

  // Maximize/minimize
  const [maximized, setMaximized] = React.useState(false)

  // Vertical divider (left/right)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const [leftWidth, setLeftWidth] = React.useState<number>(() => Math.max(280, Math.floor(window.innerWidth * 0.28)))
  const vertResizeRef = React.useRef<{ startX: number; startW: number } | null>(null)
  const [vertHandleY, setVertHandleY] = React.useState<number | null>(null)

  // Horizontal divider (staged/unstaged within left)
  const leftPaneRef = React.useRef<HTMLDivElement | null>(null)
  const stagedHeaderRef = React.useRef<HTMLDivElement | null>(null)
  const unstagedHeaderRef = React.useRef<HTMLDivElement | null>(null)
  const [stagedHeightPx, setStagedHeightPx] = React.useState<number>(200)
  const horResizeRef = React.useRef<{ startY: number; startH: number; avail: number; minPx: number } | null>(null)
  const [horHandleX, setHorHandleX] = React.useState<number | null>(null)

  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [commitMsg, setCommitMsg] = React.useState('')
  const [pushNow, setPushNow] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [opError, setOpError] = React.useState<string | undefined>(undefined)

  // Multi-select and Section-level DnD
  const [selection, setSelection] = React.useState<Set<string>>(new Set())
  const lastSelectedRef = React.useRef<{ area: 'staged' | 'unstaged'; path: string } | null>(null)
  const [dragItem, setDragItem] = React.useState<{ area: 'staged' | 'unstaged'; paths: string[] } | null>(null)
  const [dragOverArea, setDragOverArea] = React.useState<'staged' | 'unstaged' | null>(null)

  const makeKey = React.useCallback((area: 'staged' | 'unstaged', path: string) => `${area}:${path}`, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const [stagedList, unstagedList, s] = await Promise.all([
        gitService.getLocalDiffSummary(projectId, { staged: true, includePatch: true, includeStructured: true }),
        gitService.getLocalDiffSummary(projectId, { staged: false, includePatch: true, includeStructured: true }),
        gitService.getLocalStatus(projectId),
      ])
      const toEntry = (f: any): LocalFileEntry => ({ path: f?.path || f?.oldPath || '', status: f?.status, patch: f?.patch, binary: !!f?.binary })
      const staged = (Array.isArray(stagedList) ? stagedList : []).map(toEntry).filter((f) => f.path)
      const unstaged = (Array.isArray(unstagedList) ? unstagedList : []).map(toEntry).filter((f) => f.path)
      const untrackedPaths: string[] = Array.isArray((s as any)?.untracked) ? (s as any).untracked : []
      const untracked = untrackedPaths.map((p) => ({ path: p, status: 'A' } as LocalFileEntry))
      const next: LocalStatus = { staged, unstaged, untracked, conflicts: (s as any)?.conflicts || [] }
      setStatus(next)
      // Preserve multi-selection across refresh; default to first available
      const stagedPaths = next.staged.map((f) => f.path)
      const unPaths = [...next.unstaged, ...next.untracked].map((f) => f.path)
      setSelection((prev) => {
        const nextSel = new Set<string>()
        for (const k of prev) {
          const [area, ...rest] = k.split(':')
          const p = rest.join(':')
          if ((area === 'staged' && stagedPaths.includes(p)) || (area === 'unstaged' && unPaths.includes(p))) nextSel.add(k)
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
  }, [projectId, makeKey])

  React.useEffect(() => { void load() }, [load])

  // Primary selection (staged first) and reflect into selectedPath/patch
  const primarySelected = React.useMemo(() => {
    const staged = status.staged.map((f) => f.path)
    const un = [...status.unstaged, ...status.untracked].map((f) => f.path)
    for (const p of staged) if (selection.has(makeKey('staged', p))) return { area: 'staged' as const, path: p }
    for (const p of un) if (selection.has(makeKey('unstaged', p))) return { area: 'unstaged' as const, path: p }
    return null
  }, [status, selection, makeKey])

  React.useEffect(() => {
    const all = [...status.staged, ...status.unstaged, ...status.untracked]
    const f = primarySelected ? all.find((x) => x.path === primarySelected.path) : undefined
    setSelectedPatch(f?.patch || '')
    setSelectedPath(primarySelected?.path)
  }, [status, primarySelected])

  // Git operations
  const stage = async (paths: string[]) => {
    if (!paths.length) return
    setBusy(true)
    setOpError(undefined)
    try {
      const res = await gitService.stage(projectId, paths)
      if (!res?.ok) setOpError(res?.error || 'Failed to stage')
    } catch (e: any) {
      setOpError(e?.message || String(e))
    } finally {
      setBusy(false)
      void load()
    }
  }

  const unstage = async (paths: string[]) => {
    if (!paths.length) return
    setBusy(true)
    setOpError(undefined)
    try {
      const res = await gitService.unstage(projectId, paths)
      if (!res?.ok) setOpError(res?.error || 'Failed to unstage')
    } catch (e: any) {
      setOpError(e?.message || String(e))
    } finally {
      setBusy(false)
      void load()
    }
  }

  const reset = async (paths: string[]) => {
    if (!paths.length) return
    const ok = window.confirm('Discard local changes to the selected file(s)? This cannot be undone.')
    if (!ok) return
    setBusy(true)
    setOpError(undefined)
    try {
      const res = await gitService.reset(projectId, paths)
      if (!res?.ok) setOpError(res?.error || 'Failed to reset')
    } catch (e: any) {
      setOpError(e?.message || String(e))
    } finally {
      setBusy(false)
      void load()
    }
  }

  const remove = async (paths: string[]) => {
    if (!paths.length) return
    const ok = window.confirm('Delete the selected file(s) from the working tree? This cannot be undone.')
    if (!ok) return
    setBusy(true)
    setOpError(undefined)
    try {
      await Promise.all(paths.map((p) => filesService.deletePath(projectId, p)))
    } catch (e: any) {
      setOpError(e?.message || String(e))
    } finally {
      setBusy(false)
      void load()
    }
  }

  // Drag helpers
  const onDragStartRow = (area: 'staged' | 'unstaged', path: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    const allInArea = area === 'staged' ? status.staged.map((f) => f.path) : [...status.unstaged, ...status.untracked].map((f) => f.path)
    const selInArea = allInArea.filter((p) => selection.has(makeKey(area, p)))
    const paths = selection.has(makeKey(area, path)) && selInArea.length > 0 ? selInArea : [path]
    setDragItem({ area, paths })
    try { e.dataTransfer.setData('text/plain', JSON.stringify({ area, paths })) } catch {}
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
        ghost.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        ghost.textContent = `${paths.length} files`
        document.body.appendChild(ghost)
        try { e.dataTransfer.setDragImage(ghost, 12, 12) } catch {}
        const cleanup = () => { try { document.body.removeChild(ghost) } catch {} document.removeEventListener('dragend', cleanup, true) }
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
  const isSelected = (area: 'staged' | 'unstaged', path: string) => selection.has(makeKey(area, path))
  const selectSingle = (area: 'staged' | 'unstaged', path: string) => { setSelection(new Set([makeKey(area, path)])); lastSelectedRef.current = { area, path } }
  const toggleOne = (area: 'staged' | 'unstaged', path: string) => {
    setSelection((prev) => {
      const next = new Set(prev)
      const k = makeKey(area, path)
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
    lastSelectedRef.current = { area, path }
  }
  const selectRange = (area: 'staged' | 'unstaged', path: string) => {
    const anchor = lastSelectedRef.current
    const list = area === 'staged' ? status.staged.map((f) => f.path) : [...status.unstaged, ...status.untracked].map((f) => f.path)
    if (!anchor || anchor.area !== area) return selectSingle(area, path)
    const a = list.indexOf(anchor.path)
    const b = list.indexOf(path)
    if (a === -1 || b === -1) return selectSingle(area, path)
    const [start, end] = a <= b ? [a, b] : [b, a]
    const keys = list.slice(start, end + 1).map((p) => makeKey(area, p))
    setSelection(new Set(keys))
  }

  // Diff header stats from current patch
  const parseAddDel = React.useCallback((patch?: string): { add: number; del: number } => {
    if (!patch) return { add: 0, del: 0 }
    let add = 0, del = 0
    const lines = patch.replace(/\r\n/g, '\n').split('\n')
    for (const ln of lines) {
      if (ln.startsWith('+++ ') || ln.startsWith('--- ') || ln.startsWith('@@')) continue
      if (ln.startsWith('+')) add += 1
      else if (ln.startsWith('-')) del += 1
    }
    return { add, del }
  }, [])

  // Resizers
  const onVertResizeStart = (e: React.PointerEvent) => {
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    vertResizeRef.current = { startX: e.clientX, startW: leftWidth }
    const onMove = (ev: PointerEvent) => {
      const st = vertResizeRef.current; if (!st) return
      const dx = ev.clientX - st.startX
      const next = st.startW + dx
      const containerW = rootRef.current?.clientWidth || window.innerWidth
      const minLeft = Math.max(260, Math.floor(containerW * 0.2))
      const maxLeft = Math.floor(containerW * 0.8)
      setLeftWidth(Math.max(minLeft, Math.min(maxLeft, next)))
    }
    const onUp = () => { vertResizeRef.current = null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onHorResizeStart = (e: React.PointerEvent) => {
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
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
      const st = horResizeRef.current; if (!st) return
      const dy = ev.clientY - st.startY
      const next = st.startH + dy
      const maxPx = st.avail - st.minPx
      const clamped = Math.max(st.minPx, Math.min(maxPx, next))
      setStagedHeightPx(clamped)
    }
    const onUp = () => { horResizeRef.current = null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
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
  }, [maximized])

  // Ensure staged min height shows at least 2 rows and 20% of pane
  React.useEffect(() => {
    const panel = leftPaneRef.current
    if (!panel) return
    const estimatedRowPx = 28
    const stagedHMin = Math.max(estimatedRowPx * 2, Math.floor(panel.clientHeight * 0.2))
    setStagedHeightPx((h) => Math.max(stagedHMin, h))
  }, [leftWidth, maximized])

  const stagedCount = status.staged?.length || 0

  const header = (
    <div className='flex flex-col gap-1.5'>
      <div className='text-base font-semibold'>Prepare commit</div>
      <div className='text-xs text-neutral-600 dark:text-neutral-400'>Working tree · branch {currentBranch}</div>
    </div>
  )

  const headerActions = (
    <Tooltip content={maximized ? 'minimize' : 'maximize'} placement='bottom'>
      <button className='group inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800' aria-label={maximized ? 'Minimize' : 'Maximize'} title={maximized ? 'Minimize' : 'Maximize'} onClick={() => setMaximized((v) => !v)}>
        {maximized ? <IconMinimize className='w-4 h-4' /> : <IconMaximize className='w-4 h-4' />}
      </button>
    </Tooltip>
  )

  const footer = (
    <div className='flex items-center justify-between gap-2 w-full'>
      <div className='text-xs text-neutral-600 dark:text-neutral-400'>{stagedCount} file{stagedCount === 1 ? '' : 's'} staged</div>
      <div className='flex items-center gap-2'>
        <Button onClick={onRequestClose} variant='secondary'>Close</Button>
        <Button onClick={() => setConfirmOpen(true)} disabled={stagedCount === 0 || busy} loading={busy}>Proceed</Button>
      </div>
    </div>
  )

  const panelClassName = maximized ? 'max-w-none w-[calc(100vw-16px)] h-[calc(100vh-16px)] max-h-none m-2' : ''
  const rightWidth = `calc(100% - ${leftWidth}px)`

  return (
    <>
      <Modal isOpen={true} onClose={onRequestClose} title={header} size='xl' footer={footer} headerActions={headerActions} contentClassName='p-0' panelClassName={panelClassName}>
        <div ref={rootRef} className={`relative flex w-full min-h-[420px] ${maximized ? '' : 'max-h-[70vh]'}`}>
          {/* Left panel */}
          <div ref={leftPaneRef} className='shrink-0 border-r border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col' style={{ width: leftWidth }}>
            {/* Staged header */}
            <div ref={stagedHeaderRef} className='px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between'>
              <span>Staged</span>
              <Tooltip content={'Unstage all'} placement='bottom'>
                <input type='checkbox' checked={(status.staged?.length || 0) > 0} onChange={(e) => { if (!e.target.checked && (status.staged?.length || 0) > 0) void unstage(status.staged.map((f) => f.path)) }} aria-label='Unstage all' title='Unstage all' />
              </Tooltip>
            </div>
            {/* Staged list */}
            <div className={`overflow-auto ${dragOverArea === 'staged' && dragItem?.area !== 'staged' ? 'outline outline-1 outline-teal-500/60 bg-teal-500/5' : ''}`} style={{ height: stagedHeightPx }} onDragOver={(e) => { if (dragItem && dragItem.area !== 'staged') { e.preventDefault(); setDragOverArea('staged') } }} onDragLeave={() => setDragOverArea((prev) => (prev === 'staged' ? null : prev))} onDrop={onDropTo('staged')}>
              {loading ? (
                <div className='p-2 text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2'><Spinner size={12} label='Loading...' /></div>
              ) : !error ? (
                <div>
                  {status.staged.map((f) => {
                    const sel = isSelected('staged', f.path)
                    return (
                      <FileRow key={`staged:${f.path}`} file={f} checked={true} selected={sel} onToggle={() => unstage([f.path])} onReset={() => reset([f.path])} onRemove={() => remove([f.path])} draggable onDragStart={onDragStartRow('staged', f.path)} onClick={(e) => { if ((e as any).shiftKey) selectRange('staged', f.path); else if ((e as any).metaKey || (e as any).ctrlKey) toggleOne('staged', f.path); else selectSingle('staged', f.path) }} />
                    )
                  })}
                  {status.staged.length === 0 && (<div className='p-2 text-xs text-neutral-500'>No staged files.</div>)}
                </div>
              ) : (
                <div className='p-2 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap'>{error}</div>
              )}
            </div>
            {/* Horizontal resizer with visible divider and cursor handle under mouse */}
            <div className='relative h-2 cursor-row-resize group flex-shrink-0 border-y border-neutral-200 dark:border-neutral-800' role='separator' aria-orientation='horizontal' aria-label='Resize staged/unstaged' onPointerDown={onHorResizeStart} onMouseMove={(e) => { const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); setHorHandleX(e.clientX - r.left) }}>
              <div className='absolute inset-x-0 top-0 bottom-0' />
              <div className='absolute opacity-0 group-hover:opacity-100 transition-opacity' style={{ width: 48, height: 8, left: (horHandleX ?? 24) - 24, top: '50%', transform: 'translateY(-50%)' }} aria-hidden>
                <div className='h-full w-full rounded bg-teal-500/20 border border-teal-500 shadow'>
                  <div className='h-full w-full flex items-center justify-center gap-[6px]'><div className='w-[24px] h-[2px] rounded-sm bg-teal-600' /></div>
                </div>
              </div>
            </div>
            {/* Unstaged header */}
            <div ref={unstagedHeaderRef} className='px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between'>
              <span>Unstaged</span>
              <Tooltip content={'Stage all'} placement='bottom'>
                <input type='checkbox' checked={[...status.unstaged, ...status.untracked].length === 0} onChange={(e) => { if (e.target.checked && ([...status.unstaged, ...status.untracked].length > 0)) void stage([...status.unstaged, ...status.untracked].map((f) => f.path)) }} aria-label='Stage all' title='Stage all' />
              </Tooltip>
            </div>
            {/* Unstaged list */}
            <div className={`min-h-[120px] flex-1 overflow-auto ${dragOverArea === 'unstaged' && dragItem?.area !== 'unstaged' ? 'outline outline-1 outline-teal-500/60 bg-teal-500/5' : ''}`} onDragOver={(e) => { if (dragItem && dragItem.area !== 'unstaged') { e.preventDefault(); setDragOverArea('unstaged') } }} onDragLeave={() => setDragOverArea((prev) => (prev === 'unstaged' ? null : prev))} onDrop={onDropTo('unstaged')}>
              {loading ? (
                <div className='p-2 text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2'><Spinner size={12} label='Loading...' /></div>
              ) : !error ? (
                <div>
                  {[...status.unstaged, ...status.untracked].map((f) => {
                    const sel = isSelected('unstaged', f.path)
                    return (
                      <FileRow key={`unstaged:${f.path}`} file={f} checked={false} selected={sel} onToggle={() => stage([f.path])} onReset={() => reset([f.path])} onRemove={() => remove([f.path])} draggable onDragStart={onDragStartRow('unstaged', f.path)} onClick={(e) => { if ((e as any).shiftKey) selectRange('unstaged', f.path); else if ((e as any).metaKey || (e as any).ctrlKey) toggleOne('unstaged', f.path); else selectSingle('unstaged', f.path) }} />
                    )
                  })}
                  {[...status.unstaged, ...status.untracked].length === 0 && (<div className='p-2 text-xs text-neutral-500'>No unstaged files.</div>)}
                </div>
              ) : (
                <div className='p-2 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap'>{error}</div>
              )}
            </div>
          </div>

          {/* Vertical Divider with handle under cursor */}
          <div className='group absolute top-0 bottom-0' style={{ left: leftWidth - 6, width: 12, cursor: 'col-resize' }} onPointerDown={onVertResizeStart} onMouseMove={(e) => { const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); setVertHandleY(e.clientY - r.top) }} role='separator' aria-orientation='vertical' aria-label='Resize panels'>
            <div className='absolute inset-y-0 left-0 right-0' />
            <div className='absolute opacity-0 group-hover:opacity-100 transition-opacity' style={{ width: 16, height: 48, left: '50%', transform: 'translateX(-50%)', top: (vertHandleY ?? 24) - 24 }} aria-hidden>
              <div className='h-full w-full rounded bg-teal-500/20 border border-teal-500 shadow'>
                <div className='h-full w-full flex items-center justify-center gap-[3px]'>
                  <div className='w-[2px] h-[24px] rounded-sm bg-teal-600' />
                  <div className='w-[2px] h-[24px] rounded-sm bg-teal-600' />
                  <div className='w-[2px] h-[24px] rounded-sm bg-teal-600' />
                </div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className='min-w-0 min-h-0 flex flex-col' style={{ width: rightWidth }}>
            <div className='px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800'>Diff</div>
            <div className='px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 flex items-baseline gap-2 min-h-[32px] w-full'>
              {selectedPath ? (
                <>
                  <PathDisplay path={selectedPath} />
                  {selectedPatch ? (() => { const { add, del } = parseAddDel(selectedPatch); return (<span className='ml-2 opacity-80'>+{add}/-{del}</span>) })() : null}
                </>
              ) : (
                <span className='opacity-70'>No file selected</span>
              )}
            </div>
            <div className='flex-1 overflow-x-auto overflow-y-auto p-2 w-full'>
              {selectedPath ? (
                selectedPatch ? (
                  <StructuredUnifiedDiff patch={selectedPatch} />
                ) : (
                  <div className='text-xs text-neutral-600 dark:text-neutral-400'>No patch available for {selectedPath}.</div>
                )
              ) : (
                <div className='text-xs text-neutral-600 dark:text-neutral-400'>Select a file to view its diff.</div>
              )}
            </div>
          </div>
        </div>

        {opError && (<div className='mt-2 p-2 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded'>{opError}</div>)}
      </Modal>

      {/* Confirmation dialog for commit */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title={<div className='text-base font-semibold'>Confirm commit</div>} size='md' footer={
        <div className='flex items-center justify-end gap-2 w-full'>
          <Button onClick={() => setConfirmOpen(false)} variant='secondary'>Cancel</Button>
          <Button onClick={async () => { setBusy(true); setOpError(undefined); try { const res = await gitService.commit(projectId, { message: commitMsg, pushToOrigin: pushNow }); if (!res?.ok) { setOpError(res?.error || 'Commit failed'); setBusy(false); return } setBusy(false); onRequestClose() } catch (e: any) { setBusy(false); setOpError(e?.message || String(e)) } }} disabled={!commitMsg.trim() || busy} loading={busy}>
            {busy ? 'Working…' : 'Commit'}
          </Button>
        </div>
      }>
        <div className='space-y-3'>
          <div className='text-sm text-neutral-700 dark:text-neutral-300'>
            Commit {stagedCount} file{stagedCount === 1 ? '' : 's'} on <span className='font-mono'>{currentBranch}</span>
          </div>
          <div className='space-y-1'>
            <label className='text-xs text-neutral-600 dark:text-neutral-400'>Commit message</label>
            <textarea className='w-full min-h-[80px] p-2 border border-neutral-200 dark:border-neutral-800 rounded bg-surface-overlay text-sm' placeholder='Write a concise commit message...' value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} />
          </div>
          <label className='flex items-center gap-2 text-sm cursor-pointer select-none'>
            <input type='checkbox' checked={pushNow} onChange={(e) => setPushNow(e.target.checked)} />
            <span>Push immediately to origin/{currentBranch}</span>
          </label>
        </div>
      </Modal>
    </>
  )
}
