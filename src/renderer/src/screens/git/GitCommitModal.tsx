import React from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import Spinner from '@renderer/components/ui/Spinner'
import Tooltip from '@renderer/components/ui/Tooltip'
import { gitService } from '@renderer/services/gitService'
import { StructuredUnifiedDiff } from '@renderer/components/chat/tool-popups/diffUtils'

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
      className="group flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-neutral-100 dark:border-neutral-900"
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer select-none">
        <input type="checkbox" checked={checked} onChange={() => onToggle(file)} />
        <span className="truncate font-mono" title={file.path}>
          {file.path}
        </span>
      </label>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <Tooltip content={'reset (discard local changes)'} placement="bottom">
          <Button variant="ghost" size="xs" onClick={() => onReset(file)}>
            RESET
          </Button>
        </Tooltip>
        <Tooltip content={'remove (delete file)'} placement="bottom">
          <Button variant="ghost" size="xs" onClick={() => onRemove(file)}>
            REMOVE
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}

export default function GitCommitModal({ projectId, currentBranch, onRequestClose }: GitCommitModalProps) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | undefined>(undefined)
  const [status, setStatus] = React.useState<LocalStatus>({
    staged: [],
    unstaged: [],
    untracked: [],
  })
  const [selectedPath, setSelectedPath] = React.useState<string | undefined>(undefined)
  const [selectedPatch, setSelectedPatch] = React.useState<string>('')
  const [divider, setDivider] = React.useState<number>(() => Math.max(260, Math.floor(window.innerWidth * 0.22)))
  const [dragging, setDragging] = React.useState<null | { startX: number; startW: number }>(null)

  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [commitMsg, setCommitMsg] = React.useState('')
  const [pushNow, setPushNow] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [opError, setOpError] = React.useState<string | undefined>(undefined)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const s: any = await gitService.getLocalStatus(projectId as any, { includePatch: true } as any)
      const toArr = (v: any) => (Array.isArray(v) ? v : [])
      const next: LocalStatus = {
        staged: toArr(s?.staged),
        unstaged: toArr(s?.unstaged).concat(toArr(s?.changed || [])),
        untracked: toArr(s?.untracked),
        conflicts: toArr(s?.conflicts),
      }
      setStatus(next)
      // Keep selection valid
      setSelectedPath((prev) => {
        const all = [...next.staged, ...next.unstaged, ...next.untracked]
        if (prev && all.some((f) => f.path === prev)) return prev
        return all.length ? all[0].path : undefined
      })
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    const all = [...status.staged, ...status.unstaged, ...status.untracked]
    const f = all.find((x) => x.path === selectedPath)
    setSelectedPatch(f?.patch || '')
  }, [status, selectedPath])

  const stage = async (paths: string[]) => {
    setBusy(true)
    setOpError(undefined)
    try {
      const res = await gitService.stagePaths(projectId, paths)
      if (!res?.ok) setOpError(res?.error || 'Failed to stage')
    } catch (e: any) {
      setOpError(e?.message || String(e))
    } finally {
      setBusy(false)
      void load()
    }
  }

  const unstage = async (paths: string[]) => {
    setBusy(true)
    setOpError(undefined)
    try {
      const res = await gitService.unstagePaths(projectId, paths)
      if (!res?.ok) setOpError(res?.error || 'Failed to unstage')
    } catch (e: any) {
      setOpError(e?.message || String(e))
    } finally {
      setBusy(false)
      void load()
    }
  }

  const reset = async (paths: string[]) => {
    const ok = window.confirm('Discard all local changes to the selected file(s)? This cannot be undone.')
    if (!ok) return
    setBusy(true)
    setOpError(undefined)
    try {
      const res = await gitService.resetPaths(projectId, paths)
      if (!res?.ok) setOpError(res?.error || 'Failed to reset')
    } catch (e: any) {
      setOpError(e?.message || String(e))
    } finally {
      setBusy(false)
      void load()
    }
  }

  const remove = async (paths: string[]) => {
    const ok = window.confirm('Delete the selected file(s) from the working tree? This cannot be undone.')
    if (!ok) return
    setBusy(true)
    setOpError(undefined)
    try {
      const res = await gitService.removePaths(projectId, paths)
      if (!res?.ok) setOpError(res?.error || 'Failed to remove')
    } catch (e: any) {
      setOpError(e?.message || String(e))
    } finally {
      setBusy(false)
      void load()
    }
  }

  const stagedCount = status.staged?.length || 0

  const onDragStart = (kind: 'staged' | 'unstaged' | 'untracked', path: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({ kind, path }))
  }

  const onDropTo = (target: 'staged' | 'unstaged') => async (e: React.DragEvent) => {
    e.preventDefault()
    try {
      const raw = e.dataTransfer.getData('text/plain')
      if (!raw) return
      const payload = JSON.parse(raw)
      const { kind, path } = payload as { kind: string; path: string }
      if (target === 'staged') {
        await stage([path])
      } else {
        await unstage([path])
      }
    } catch {}
  }

  const onDividerStart = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDragging({ startX: e.clientX, startW: divider })
    const onMove = (ev: PointerEvent) => {
      setDivider((prev) => {
        const start = dragging?.startW ?? prev
        const dx = ev.clientX - (dragging?.startX ?? ev.clientX)
        const clamped = Math.max(220, Math.min(Math.floor(window.innerWidth * 0.6), start + dx))
        return clamped
      })
    }
    const onUp = () => {
      setDragging(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const header = (
    <div className="flex flex-col gap-1.5">
      <div className="text-base font-semibold">Prepare commit</div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400">
        Working tree · branch {currentBranch}
      </div>
    </div>
  )

  const footer = (
    <div className="flex items-center justify-between gap-2 w-full">
      <div className="text-xs text-neutral-600 dark:text-neutral-400">
        {stagedCount} file{stagedCount === 1 ? '' : 's'} staged
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onRequestClose} variant="secondary">
          Close
        </Button>
        <Button onClick={() => setConfirmOpen(true)} disabled={stagedCount === 0 || busy} loading={busy}>
          Proceed
        </Button>
      </div>
    </div>
  )

  const leftWidth = divider
  const rightWidth = `calc(100% - ${divider}px)`

  return (
    <>
      <Modal isOpen={true} onClose={onRequestClose} title={header} size="xl" footer={footer}>
        <div className="relative flex w-full min-h-[420px] max-h-[70vh]">
          {/* Left panel */}
          <div className="shrink-0 border-r border-neutral-200 dark:border-neutral-800 overflow-hidden" style={{ width: leftWidth }}>
            <div className="grid grid-cols-2 text-[11px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
              <div className="px-2 py-1 border-b border-neutral-200 dark:border-neutral-800">Unstaged</div>
              <div className="px-2 py-1 border-b border-neutral-200 dark:border-neutral-800">Staged</div>
            </div>
            <div className="grid grid-cols-2 h-full min-h-[360px]">
              {/* Unstaged + Untracked */}
              <div
                className="min-h-0 overflow-auto"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropTo('unstaged')}
              >
                {loading && (
                  <div className="p-2 text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                    <Spinner size={12} label="Loading..." />
                  </div>
                )}
                {!loading && error && (
                  <div className="p-2 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</div>
                )}
                {!loading && !error && (
                  <div>
                    {[...status.unstaged, ...status.untracked].map((f) => (
                      <div
                        key={`unstaged:${f.path}`}
                        onClick={() => setSelectedPath(f.path)}
                        className={`cursor-pointer ${selectedPath === f.path ? 'bg-neutral-50 dark:bg-neutral-900/40' : ''}`}
                      >
                        <FileRow
                          file={f}
                          checked={false}
                          onToggle={() => stage([f.path])}
                          onReset={() => reset([f.path])}
                          onRemove={() => remove([f.path])}
                          draggable
                          onDragStart={onDragStart('unstaged', f.path)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Staged */}
              <div
                className="min-h-0 overflow-auto"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropTo('staged')}
              >
                {loading && (
                  <div className="p-2 text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                    <Spinner size={12} label="Loading..." />
                  </div>
                )}
                {!loading && !error && (
                  <div>
                    {status.staged.map((f) => (
                      <div
                        key={`staged:${f.path}`}
                        onClick={() => setSelectedPath(f.path)}
                        className={`cursor-pointer ${selectedPath === f.path ? 'bg-neutral-50 dark:bg-neutral-900/40' : ''}`}
                      >
                        <FileRow
                          file={f}
                          checked={true}
                          onToggle={() => unstage([f.path])}
                          onReset={() => reset([f.path])}
                          onRemove={() => remove([f.path])}
                          draggable
                          onDragStart={onDragStart('staged', f.path)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div
            className="group absolute top-0 bottom-0"
            style={{ left: leftWidth - 6, width: 12, cursor: 'col-resize' }}
            onPointerDown={onDividerStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize commit panels"
          >
            <div className="absolute left-[2px] top-1/2 -translate-y-1/2 w-[8px] h-[40px] rounded bg-teal-500/20 border border-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Right panel */}
          <div className="min-w-0 min-h-0" style={{ width: rightWidth }}>
            <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
              Diff
            </div>
            <div className="min-h-[360px] max-h-[60vh] overflow-auto p-2">
              {selectedPath ? (
                selectedPatch ? (
                  <StructuredUnifiedDiff patch={selectedPatch} />
                ) : (
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">No patch available for {selectedPath}.</div>
                )
              ) : (
                <div className="text-xs text-neutral-600 dark:text-neutral-400">Select a file to view its diff.</div>
              )}
            </div>
          </div>
        </div>

        {opError && (
          <div className="mt-2 p-2 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded">
            {opError}
          </div>
        )}
      </Modal>

      {/* Confirmation dialog for commit */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={<div className="text-base font-semibold">Confirm commit</div>}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button onClick={() => setConfirmOpen(false)} variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setBusy(true)
                setOpError(undefined)
                try {
                  const res = await gitService.commit(projectId, { message: commitMsg } as any)
                  if (!res?.ok) {
                    setOpError(res?.error || 'Commit failed')
                    setBusy(false)
                    return
                  }
                  if (pushNow) {
                    const pushRes = await gitService.push(projectId, 'origin', currentBranch)
                    if (!pushRes?.ok) {
                      setOpError(pushRes?.error || 'Push failed')
                      setBusy(false)
                      return
                    }
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
        <div className="space-y-3">
          <div className="text-sm text-neutral-700 dark:text-neutral-300">
            Commit {stagedCount} file{stagedCount === 1 ? '' : 's'} on <span className="font-mono">{currentBranch}</span>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-neutral-600 dark:text-neutral-400">Commit message</label>
            <textarea
              className="w-full min-h-[80px] p-2 border border-neutral-200 dark:border-neutral-800 rounded bg-surface-overlay text-sm"
              placeholder="Write a concise commit message..."
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={pushNow} onChange={(e) => setPushNow(e.target.checked)} />
            <span>Push immediately to origin/{currentBranch}</span>
          </label>
        </div>
      </Modal>
    </>
  )
}
