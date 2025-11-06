import React from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import Spinner from '@renderer/components/ui/Spinner'
import Tooltip from '@renderer/components/ui/Tooltip'
import { gitService } from '@renderer/services/gitService'
import { filesService } from '@renderer/services/filesService'
import { StructuredUnifiedDiff } from '@renderer/components/chat/tool-popups/diffUtils'
import {
  IconDelete,
  IconRefresh,
  IconFileAdded,
  IconFileDeleted,
  IconFileModified,
} from '@renderer/components/ui/icons/Icons'

export type GitCommitModalProps = {
  projectId: string
  currentBranch: string
  onRequestClose: () => void
}

type LocalFileEntry = {
  path: string
  status?: string
  patch?: string
  binary?: boolean
}

type LocalStatus = {
  staged: LocalFileEntry[]
  unstaged: LocalFileEntry[]
  untracked: LocalFileEntry[]
  conflicts?: any[]
}

function StatusIcon({ status }: { status?: string }) {
  const cls = 'w-4 h-4'
  if (status === 'A') return <IconFileAdded className={cls} />
  if (status === 'D') return <IconFileDeleted className={cls} />
  return <IconFileModified className={cls} />
}

function FileRow({
  file,
  checked,
  onToggle,
  onReset,
  onRemove,
  draggable,
  onDragStart,
}: {
  file: LocalFileEntry
  checked: boolean
  onToggle: (file: LocalFileEntry) => void
  onReset: (file: LocalFileEntry) => void
  onRemove: (file: LocalFileEntry) => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}) {
  return (
    <div
      className='group flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-neutral-100 dark:border-neutral-900'
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <label className='flex items-center gap-2 min-w-0 flex-1 cursor-pointer select-none'>
        <input type='checkbox' checked={checked} onChange={() => onToggle(file)} />
        <StatusIcon status={file.status} />
        <span className='truncate font-mono' title={file.path}>
          {file.path}
        </span>
      </label>
      <div className='opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1'>
        <Tooltip content={'Reset (discard local changes)'} placement='bottom'>
          <button
            className='btn-secondary btn-icon'
            aria-label='Reset file changes'
            onClick={(e) => {
              e.stopPropagation()
              onReset(file)
            }}
          >
            <IconRefresh className='w-4 h-4' />
          </button>
        </Tooltip>
        <Tooltip content={'Remove (delete file)'} placement='bottom'>
          <button
            className='btn-secondary btn-icon'
            aria-label='Remove file'
            onClick={(e) => {
              e.stopPropagation()
              onRemove(file)
            }}
          >
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

  const [divider, setDivider] = React.useState<number>(() => Math.max(260, Math.floor(window.innerWidth * 0.22)))
  const [draggingDivider, setDraggingDivider] = React.useState<null | { startX: number; startW: number }>(null)

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

  const makeKey = React.useCallback((area: 'staged' | 'unstaged', path: string) => `${area}:${path}`,[ ])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const [stagedList, unstagedList, s] = await Promise.all([
        gitService.getLocalDiffSummary(projectId, { staged: true, includePatch: true, includeStructured: true }),
        gitService.getLocalDiffSummary(projectId, { staged: false, includePatch: true, includeStructured: true }),
        gitService.getLocalStatus(projectId),
      ])

      const toEntry = (f: any): LocalFileEntry => ({
        path: f?.path || f?.oldPath || '',
        status: f?.status,
        patch: f?.patch,
        binary: !!f?.binary,
      })

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
          if ((area === 'staged' && stagedPaths.includes(p)) || (area === 'unstaged' && unPaths.includes(p))) {
            nextSel.add(k)
          }
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

  // Divider handlers
  const onDividerStart = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDraggingDivider({ startX: e.clientX, startW: divider })
    const onMove = (ev: PointerEvent) => {
      setDivider((prev) => {
        const start = draggingDivider?.startW ?? prev
        const dx = ev.clientX - (draggingDivider?.startX ?? ev.clientX)
        const clamped = Math.max(220, Math.min(Math.floor(window.innerWidth * 0.6), start + dx))
        return clamped
      })
    }
    const onUp = () => {
      setDraggingDivider(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const stagedCount = status.staged?.length || 0

  const header = (
    <div className='flex flex-col gap-1.5'>
      <div className='text-base font-semibold'>Prepare commit</div>
      <div className='text-xs text-neutral-600 dark:text-neutral-400'>Working tree · branch {currentBranch}</div>
    </div>
  )

  const footer = (
    <div className='flex items-center justify-between gap-2 w-full'>
      <div className='text-xs text-neutral-600 dark:text-neutral-400'>
        {stagedCount} file{stagedCount === 1 ? '' : 's'} staged
      </div>
      <div className='flex items-center gap-2'>
        <Button onClick={onRequestClose} variant='secondary'>Close</Button>
        <Button onClick={() => setConfirmOpen(true)} disabled={stagedCount === 0 || busy} loading={busy}>Proceed</Button>
      </div>
    </div>
  )

  const leftWidth = divider
  const rightWidth = `calc(100% - ${divider}px)`

  return (
    <>
      <Modal isOpen={true} onClose={onRequestClose} title={header} size='xl' footer={footer}>
        <div className='relative flex w-full min-h-[420px] max-h-[70vh]'>
          {/* Left panel */}
          <div className='shrink-0 border-r border-neutral-200 dark:border-neutral-800 overflow-hidden' style={{ width: leftWidth }}>
            <div className='flex flex-col h-full'>
              {/* Staged header */}
              <div className='px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between'>
                <span>Staged</span>
                <Tooltip content={'Unstage all'} placement='bottom'>
                  <input
                    type='checkbox'
                    checked={(status.staged?.length || 0) > 0}
                    onChange={(e) => {
                      if (!e.target.checked && (status.staged?.length || 0) > 0) {
                        void unstage(status.staged.map((f) => f.path))
                      }
                    }}
                    aria-label='Unstage all'
                    title='Unstage all'
                  />
                </Tooltip>
              </div>

              {/* Staged list (drop target) */}
              <div
                className={`min-h-[160px] max-h-[35vh] overflow-auto ${dragOverArea === 'staged' && dragItem?.area !== 'staged' ? 'outline outline-1 outline-teal-500/60 bg-teal-500/5' : ''}`}
                onDragOver={(e) => { if (dragItem && dragItem.area !== 'staged') { e.preventDefault(); setDragOverArea('staged') } }}
                onDragLeave={() => setDragOverArea((prev) => (prev === 'staged' ? null : prev))}
                onDrop={onDropTo('staged')}
              >
                {loading && (
                  <div className='p-2 text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2'>
                    <Spinner size={12} label='Loading...' />
                  </div>
                )}
                {!loading && !error && (
                  <div>
                    {status.staged.map((f) => {
                      const sel = isSelected('staged', f.path)
                      return (
                        <div
                          key={`staged:${f.path}`}
                          onClick={(e) => { if (e.shiftKey) selectRange('staged', f.path); else if (e.metaKey || e.ctrlKey) toggleOne('staged', f.path); else selectSingle('staged', f.path) }}
                          className={`cursor-pointer ${sel ? 'bg-neutral-50 dark:bg-neutral-900/40' : ''}`}
                        >
                          <FileRow
                            file={f}
                            checked={true}
                            onToggle={() => unstage([f.path])}
                            onReset={() => reset([f.path])}
                            onRemove={() => remove([f.path])}
                            draggable
                            onDragStart={onDragStartRow('staged', f.path)}
                          />
                        </div>
                      )
                    })}
                    {status.staged.length === 0 && (
                      <div className='p-2 text-xs text-neutral-500'>No staged files.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Unstaged header */}
              <div className='px-2 py-1 mt-2 text-[11px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between'>
                <span>Unstaged</span>
                <Tooltip content={'Stage all'} placement='bottom'>
                  <input
                    type='checkbox'
                    checked={[...status.unstaged, ...status.untracked].length === 0}
                    onChange={(e) => { if (e.target.checked && ([...status.unstaged, ...status.untracked].length > 0)) { void stage([...status.unstaged, ...status.untracked].map((f) => f.path)) } }}
                    aria-label='Stage all'
                    title='Stage all'
                  />
                </Tooltip>
              </div>

              {/* Unstaged list (drop target) */}
              <div
                className={`min-h-[160px] overflow-auto ${dragOverArea === 'unstaged' && dragItem?.area !== 'unstaged' ? 'outline outline-1 outline-teal-500/60 bg-teal-500/5' : ''}`}
                onDragOver={(e) => { if (dragItem && dragItem.area !== 'unstaged') { e.preventDefault(); setDragOverArea('unstaged') } }}
                onDragLeave={() => setDragOverArea((prev) => (prev === 'unstaged' ? null : prev))}
                onDrop={onDropTo('unstaged')}
              >
                {loading && (
                  <div className='p-2 text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2'>
                    <Spinner size={12} label='Loading...' />
                  </div>
                )}
                {!loading && error && (
                  <div className='p-2 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap'>
                    {error}
                  </div>
                )}
                {!loading && !error && (
                  <div>
                    {[...status.unstaged, ...status.untracked].map((f) => {
                      const sel = isSelected('unstaged', f.path)
                      return (
                        <div
                          key={`unstaged:${f.path}`}
                          onClick={(e) => { if (e.shiftKey) selectRange('unstaged', f.path); else if (e.metaKey || e.ctrlKey) toggleOne('unstaged', f.path); else selectSingle('unstaged', f.path) }}
                          className={`cursor-pointer ${sel ? 'bg-neutral-50 dark:bg-neutral-900/40' : ''}`}
                        >
                          <FileRow
                            file={f}
                            checked={false}
                            onToggle={() => stage([f.path])}
                            onReset={() => reset([f.path])}
                            onRemove={() => remove([f.path])}
                            draggable
                            onDragStart={onDragStartRow('unstaged', f.path)}
                          />
                        </div>
                      )
                    })}
                    {[...status.unstaged, ...status.untracked].length === 0 && (
                      <div className='p-2 text-xs text-neutral-500'>No unstaged files.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div
            className='group absolute top-0 bottom-0'
            style={{ left: leftWidth - 6, width: 12, cursor: 'col-resize' }}
            onPointerDown={onDividerStart}
            role='separator'
            aria-orientation='vertical'
            aria-label='Resize commit panels'
          >
            <div className='absolute left-[2px] top-1/2 -translate-y-1/2 w-[8px] h-[40px] rounded bg-teal-500/20 border border-teal-500 opacity-0 group-hover:opacity-100 transition-opacity' />
          </div>

          {/* Right panel */}
          <div className='min-w-0 min-h-0' style={{ width: rightWidth }}>
            <div className='px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800'>
              Diff
            </div>
            <div className='px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 min-h-[32px]'>
              {selectedPath ? (
                <>
                  <span className='font-mono truncate' title={selectedPath}>{selectedPath}</span>
                  {selectedPatch ? (() => { const { add, del } = parseAddDel(selectedPatch); return (<span className='ml-1'>+{add}/-{del}</span>) })() : null}
                </>
              ) : (
                <span className='opacity-70'>No file selected</span>
              )}
            </div>
            <div className='min-h-[328px] max-h-[60vh] overflow-auto p-2'>
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

        {opError && (
          <div className='mt-2 p-2 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded'>
            {opError}
          </div>
        )}
      </Modal>

      {/* Confirmation dialog for commit */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={<div className='text-base font-semibold'>Confirm commit</div>}
        size='md'
        footer={
          <div className='flex items-center justify-end gap-2 w-full'>
            <Button onClick={() => setConfirmOpen(false)} variant='secondary'>Cancel</Button>
            <Button
              onClick={async () => {
                setBusy(true)
                setOpError(undefined)
                try {
                  const res = await gitService.commit(projectId, { message: commitMsg, pushToOrigin: pushNow })
                  if (!res?.ok) {
                    setOpError(res?.error || 'Commit failed')
                    setBusy(false)
                    return
                  }
                  setBusy(false)
                  onRequestClose()
                } catch (e: any) {
                  setBusy(false)
                  setOpError(e?.message || String(e))
                }
              }}
              disabled={!commitMsg.trim() || busy}
              loading={busy}
            >
              {busy ? 'Working…' : 'Commit'}
            </Button>
          </div>
        }
      >
        <div className='space-y-3'>
          <div className='text-sm text-neutral-700 dark:text-neutral-300'>
            Commit {stagedCount} file{stagedCount === 1 ? '' : 's'} on <span className='font-mono'>{currentBranch}</span>
          </div>
          <div className='space-y-1'>
            <label className='text-xs text-neutral-600 dark:text-neutral-400'>Commit message</label>
            <textarea
              className='w-full min-h-[80px] p-2 border border-neutral-200 dark:border-neutral-800 rounded bg-surface-overlay text-sm'
              placeholder='Write a concise commit message...'
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
            />
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
