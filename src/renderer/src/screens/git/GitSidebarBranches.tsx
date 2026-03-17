import React, { useState, useRef, useEffect } from 'react'
import Spinner from '../../components/ui/Spinner'
import { GitUnifiedBranch, GitStashListItem } from 'thefactory-tools'
import { BranchChip } from '../../components/ui/BranchChip'
import { ResizeHandle } from '../../components/ui/ResizeHandle'

function BranchRow({
  branch,
  isSelected,
  equalToCurrent,
  hasPendingChanges,
  onClick,
}: {
  branch: GitUnifiedBranch
  isSelected: boolean
  equalToCurrent?: boolean
  hasPendingChanges?: boolean
  onClick?: () => void
}) {
  const unread = hasPendingChanges
  const rowCls =
    'flex items-center gap-2 px-3 py-2 rounded cursor-pointer ' +
    (isSelected
      ? 'bg-blue-50/80 dark:bg-blue-900/20'
      : 'hover:bg-neutral-100 dark:hover:bg-neutral-900/40')

  return (
    <div className={rowCls} onClick={onClick}>
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{branch.name}</div>
          {branch.current ? <BranchChip type="current" size="xs" /> : null}
          {equalToCurrent && !branch.current ? <BranchChip type="same" size="xs" /> : null}
          {unread ? <BranchChip type="updated" size="xs" /> : null}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {branch.isLocal ? <BranchChip type="local" size="xs" /> : null}
          {branch.isRemote ? <BranchChip type="remote" size="xs" /> : null}
          {branch.storyId ? <BranchChip type="story" size="xs" label={`Story ${branch.storyId}`} /> : null}
        </div>
      </div>
    </div>
  )
}

export function GitSidebarBranches({
  projectId,
  loading,
  error,
  localBranches,
  stashes,
  current,
  others,
  selectedBranchName,
  selectedStashRef,
  isEqualToCurrent,
  onSelectBranch,
  onSelectStash,
}: {
  title?: string
  projectId?: string
  loading: boolean
  error?: string
  localBranches: GitUnifiedBranch[]
  stashes?: GitStashListItem[]
  current?: GitUnifiedBranch
  others: GitUnifiedBranch[]
  selectedBranchName?: string
  selectedStashRef?: string
  isEqualToCurrent: (b: GitUnifiedBranch) => boolean
  onSelectBranch: (name: string) => void
  onSelectStash: (ref: string) => void
}) {
  const [widthPx, setWidthPx] = useState<number>(280)
  const resizeRef = useRef<{ startX: number; startW: number; maxW: number } | null>(null)

  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const maxW = Math.max(100, Math.floor(window.innerWidth * 0.5))
    resizeRef.current = { startX: e.clientX, startW: widthPx, maxW }

    const onMove = (ev: PointerEvent) => {
      const st = resizeRef.current
      if (!st) return
      const dx = ev.clientX - st.startX
      const next = st.startW + dx
      setWidthPx(Math.max(100, Math.min(st.maxW, next)))
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Clamp width on resize
  useEffect(() => {
    const clamp = () => {
      const maxW = Math.max(100, Math.floor(window.innerWidth * 0.5))
      setWidthPx((v) => Math.max(100, Math.min(maxW, v)))
    }
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [])

  return (
    <div
      className="relative shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col min-h-0 pt-2"
      style={{ width: widthPx }}
    >
      <div className="flex-1 min-h-0 overflow-auto">
        {!projectId ? (
          <div className="px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300">No active project.</div>
        ) : loading ? (
          <div className="px-3 py-2 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <Spinner /> Loading…
          </div>
        ) : error ? (
          <div className="px-3 py-2 text-sm text-red-700 dark:text-red-200">Error: {error}</div>
        ) : localBranches.length === 0 ? (
          <div className="px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300">No local branches found.</div>
        ) : (
          <div className="flex flex-col gap-1 px-1 pb-2">
            {current ? (
              <>
                <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Current
                </div>
                <BranchRow
                  branch={current}
                  isSelected={selectedBranchName === current.name && !selectedStashRef}
                  equalToCurrent={false}
                  hasPendingChanges={false}
                  onClick={() => onSelectBranch(current.name)}
                />
                <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Local
                </div>
              </>
            ) : null}

            {others.map((b) => (
              <BranchRow
                key={b.name}
                branch={b}
                isSelected={selectedBranchName === b.name && !selectedStashRef}
                equalToCurrent={isEqualToCurrent(b)}
                hasPendingChanges={false}
                onClick={() => onSelectBranch(b.name)}
              />
            ))}

            {stashes && stashes.length > 0 ? (
              <>
                <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Stashes
                </div>
                {stashes.map((s) => (
                  <div
                    key={s.ref}
                    className={
                      'flex items-center gap-2 px-3 py-2 rounded cursor-pointer ' +
                      (selectedStashRef === s.ref
                        ? 'bg-blue-50/80 dark:bg-blue-900/20'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-900/40')
                    }
                    onClick={() => onSelectStash(s.ref)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{s.message}</div>
                    </div>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        )}
      </div>

      <ResizeHandle
        orientation="vertical"
        className="absolute top-0 bottom-0 -right-[3px] z-10 hover:bg-neutral-300/50 dark:hover:bg-neutral-700/50 transition-colors"
        hitBoxSize={6}
        onResizeStart={onResizeStart}
      />
    </div>
  )
}
